import { spawn } from "node:child_process";
import path from "node:path";
import { ForecastDataStatus, ForecastPointType, ForecastQuality, Prisma, RecommendationPriority } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../middleware/errors.js";

const DAY = 86_400_000;
const HISTORY_DAYS = 365;
const DEFAULT_HORIZON = 14;
const ALLOWED_HORIZONS = [7, 14, 30] as const;

export type ForecastFilters = {
  warehouseId?: string;
  horizonDays?: string;
  page?: string;
  pageSize?: string;
};

type AnalyticsResult = {
  data_status: "SUFFICIENT" | "LIMITED" | "INSUFFICIENT";
  history_start: string | null;
  history_end: string | null;
  observation_count: number;
  non_zero_observation_count: number;
  selected_method: string;
  candidate_methods: string[];
  candidate_metrics: Record<string, { mae: number | null; rmse: number | null; mape: number | null; observations: number }>;
  selection_reason: string;
  trend: { direction: string; magnitude_percent: number | null; explanation: string };
  seasonality: { detected: boolean; type: string | null; strength: number | null; explanation: string };
  quality: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";
  quality_reason: string;
  uncertainty_available: boolean;
  uncertainty_method: string | null;
  evaluation_period: number;
  metrics: { mae: number | null; rmse: number | null; mape: number | null; observations: number };
  historical: { date: string; units: number }[];
  forecast: { date: string; predicted: number; lower: number | null; upper: number | null }[];
  backtest: { date: string; offset: number; actual: number; predicted: number }[];
};

function parseHorizon(value: unknown) {
  const horizon = Number(value || DEFAULT_HORIZON);
  if (!ALLOWED_HORIZONS.includes(horizon as (typeof ALLOWED_HORIZONS)[number])) throw new AppError("VALIDATION_ERROR", "Forecast horizon must be 7, 14, or 30 days.", 422);
  return horizon;
}

function pageInfo(filters: ForecastFilters) {
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 25));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateFromOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function asNumber(value: unknown) {
  return Number(value ?? 0);
}

async function runPython(payload: Record<string, unknown>): Promise<AnalyticsResult> {
  const script = path.resolve(process.cwd(), "analytics/service.py");
  const python = process.env.PYTHON_BIN ?? "python3";
  return new Promise((resolve, reject) => {
    const child = spawn(python, [script], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new AppError("ANALYTICS_TIMEOUT", "Forecast generation timed out. The operational API remains available.", 504));
    }, 20_000);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new AppError("ANALYTICS_UNAVAILABLE", `Forecasting service is unavailable: ${error.message}`, 503));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        const result = JSON.parse(stdout);
        if (!result.ok) {
          reject(new AppError("FORECAST_FAILED", result.error || "The analytics service could not produce a forecast.", 422));
          return;
        }
        resolve(result.result as AnalyticsResult);
      } catch {
        reject(new AppError("ANALYTICS_INVALID_OUTPUT", stderr || "The analytics service returned malformed output.", 502));
      }
      if (code !== 0 && !stdout) reject(new AppError("ANALYTICS_UNAVAILABLE", stderr || "The analytics service exited unexpectedly.", 503));
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

async function getProduct(organizationId: string, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, organizationId, isActive: true }, include: { preferredSupplier: true, inventoryLevels: { include: { warehouse: true } } } });
  if (!product) throw new AppError("NOT_FOUND", "Product not found.", 404);
  return product;
}

async function getWarehouse(organizationId: string, warehouseId: string) {
  const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, organizationId, isActive: true } });
  if (!warehouse) throw new AppError("NOT_FOUND", "Warehouse not found.", 404);
  return warehouse;
}

async function getSeries(organizationId: string, productId: string, warehouseId?: string) {
  const end = new Date();
  const start = new Date(end.getTime() - HISTORY_DAYS * DAY);
  const transactions = await prisma.inventoryTransaction.findMany({
    where: { organizationId, productId, warehouseId, type: "SALE", createdAt: { gte: start, lte: end } },
    select: { quantity: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const grouped = new Map<string, number>();
  for (const transaction of transactions) {
    const key = dateOnly(transaction.createdAt);
    grouped.set(key, (grouped.get(key) ?? 0) + transaction.quantity);
  }
  return {
    start,
    end,
    observations: [...grouped.entries()].map(([date, units]) => ({ date, units })),
  };
}

function runData(result: AnalyticsResult) {
  return {
    dataStatus: result.data_status as ForecastDataStatus,
    quality: result.quality as ForecastQuality,
    selectedMethod: result.selected_method,
    candidateMethods: result.candidate_methods,
    candidateMetrics: result.candidate_metrics,
    historyStart: result.history_start ? dateFromOnly(result.history_start) : null,
    historyEnd: result.history_end ? dateFromOnly(result.history_end) : null,
    observationCount: result.observation_count,
    nonZeroObservationCount: result.non_zero_observation_count,
    evaluationPeriod: result.evaluation_period,
    mae: result.metrics.mae,
    rmse: result.metrics.rmse,
    mape: result.metrics.mape,
    trendDirection: result.trend.direction,
    trendMagnitude: result.trend.magnitude_percent,
    seasonalityDetected: result.seasonality.detected,
    seasonalityType: result.seasonality.type,
    seasonalityStrength: result.seasonality.strength,
    uncertaintyAvailable: result.uncertainty_available,
    uncertaintyMethod: result.uncertainty_method,
    selectionReason: result.selection_reason,
    qualityReason: result.quality_reason,
  };
}

async function persistRun(organizationId: string, productId: string, warehouseId: string | undefined, generatedById: string, horizonDays: number, result: AnalyticsResult) {
  const run = await prisma.forecastRun.create({
    data: {
      organizationId, productId, warehouseId, generatedById, horizonDays, ...runData(result),
      points: {
        create: [
          ...result.forecast.map((point) => ({ forecastDate: dateFromOnly(point.date), pointType: ForecastPointType.FORECAST, predictedQuantity: point.predicted, lowerBound: point.lower, upperBound: point.upper })),
          ...result.backtest.map((point) => ({ forecastDate: dateFromOnly(point.date), pointType: ForecastPointType.BACKTEST, predictedQuantity: point.predicted, actualQuantity: point.actual, error: point.predicted - point.actual })),
        ],
      },
    },
    include: { product: true, warehouse: true, points: { orderBy: { forecastDate: "asc" } } },
  });
  return run;
}

async function applyForecastRecommendation(organizationId: string, productId: string, warehouseId: string | undefined, run: Awaited<ReturnType<typeof persistRun>>, result: AnalyticsResult) {
  if (!warehouseId || result.data_status === "INSUFFICIENT" || result.quality === "INSUFFICIENT_DATA") return null;
  const product = await getProduct(organizationId, productId);
  const supplierLeadTime = product.preferredSupplier?.averageLeadTime;
  if (!supplierLeadTime || supplierLeadTime < 1) return null;
  const level = product.inventoryLevels.find((item) => item.warehouseId === warehouseId);
  if (!level) return null;
  const values = result.forecast.map((point) => point.predicted);
  const forecastDaily = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const demandFor = (days: number) => values.slice(0, days).reduce((sum, value) => sum + value, 0) + forecastDaily * Math.max(0, days - values.length);
  const leadTimeDemand = demandFor(supplierLeadTime);
  const reviewDemand = forecastDaily * 14;
  const reorderPoint = Math.ceil(leadTimeDemand + product.safetyStock);
  const targetStock = Math.ceil(leadTimeDemand + product.safetyStock + reviewDemand);
  const recommendedQuantity = Math.max(0, targetStock - (level.onHandQuantity - level.reservedQuantity));
  if (recommendedQuantity <= 0) return null;
  const priority = result.quality === "HIGH" ? RecommendationPriority.MEDIUM : result.quality === "MEDIUM" ? RecommendationPriority.HIGH : RecommendationPriority.HIGH;
  const reason = `Forecast-aware order: ${recommendedQuantity} units based on ${result.selected_method.replaceAll("_", " ").toLowerCase()}, a ${Math.round(demandFor(Math.min(14, result.forecast.length)))}-unit forecast horizon signal, ${supplierLeadTime} days lead time, ${product.safetyStock} units safety stock, ${level.onHandQuantity - level.reservedQuantity} available units, and ${result.quality.toLowerCase()} forecast quality.`;
  return prisma.replenishmentRecommendation.upsert({
    where: { organizationId_productId_warehouseId: { organizationId, productId, warehouseId } },
    create: {
      organizationId, productId, warehouseId, fingerprint: `${productId}:${warehouseId}`, priority, status: "OPEN", riskLevel: priority,
      recommendedQuantity, reorderPoint, targetStock, currentAvailable: level.onHandQuantity - level.reservedQuantity,
      averageDailyDemand: forecastDaily, leadTimeDays: supplierLeadTime, safetyStock: product.safetyStock,
      estimatedImpact: recommendedQuantity * asNumber(product.purchasePrice), stockoutHorizonDays: forecastDaily > 0 ? (level.onHandQuantity - level.reservedQuantity) / forecastDaily : null,
      reason, recommendationMode: "FORECAST_AWARE", forecastRunId: run.id, forecastMethod: result.selected_method, forecastQuality: result.quality,
      forecastDemand: demandFor(result.forecast.length), forecastHorizonDays: result.forecast.length,
    },
    update: {
      priority, recommendedQuantity, reorderPoint, targetStock, currentAvailable: level.onHandQuantity - level.reservedQuantity,
      averageDailyDemand: forecastDaily, leadTimeDays: supplierLeadTime, safetyStock: product.safetyStock,
      estimatedImpact: recommendedQuantity * asNumber(product.purchasePrice), stockoutHorizonDays: forecastDaily > 0 ? (level.onHandQuantity - level.reservedQuantity) / forecastDaily : null,
      reason, recommendationMode: "FORECAST_AWARE", forecastRunId: run.id, forecastMethod: result.selected_method, forecastQuality: result.quality,
      forecastDemand: demandFor(result.forecast.length), forecastHorizonDays: result.forecast.length,
    },
    include: { product: true, warehouse: true },
  });
}

export async function generateForecast(organizationId: string, productId: string, generatedById: string, input: { warehouseId?: string; horizonDays?: number }) {
  const product = await getProduct(organizationId, productId);
  if (input.warehouseId) await getWarehouse(organizationId, input.warehouseId);
  const horizonDays = parseHorizon(input.horizonDays);
  const series = await getSeries(organizationId, productId, input.warehouseId);
  const result = await runPython({ product_id: productId, warehouse_id: input.warehouseId ?? null, horizon_days: horizonDays, end_date: dateOnly(series.end), observations: series.observations });
  const run = await persistRun(organizationId, productId, input.warehouseId, generatedById, horizonDays, result);
  const recommendation = await applyForecastRecommendation(organizationId, productId, input.warehouseId, run, result);
  return { run: serializeRun(run), recommendation, explanation: result.quality_reason, methodology: "Node selected tenant-scoped completed SALE history; Python compared naive, 7-day moving average, and exponential smoothing with chronological backtesting." };
}

function serializeRun(run: any) {
  return {
    ...run,
    mae: run.mae === null ? null : Number(run.mae),
    rmse: run.rmse === null ? null : Number(run.rmse),
    mape: run.mape === null ? null : Number(run.mape),
    trendMagnitude: run.trendMagnitude === null ? null : Number(run.trendMagnitude),
    seasonalityStrength: run.seasonalityStrength === null ? null : Number(run.seasonalityStrength),
    points: run.points?.map((point: any) => ({ ...point, predictedQuantity: Number(point.predictedQuantity), actualQuantity: point.actualQuantity === null ? null : Number(point.actualQuantity), lowerBound: point.lowerBound === null ? null : Number(point.lowerBound), upperBound: point.upperBound === null ? null : Number(point.upperBound), error: point.error === null ? null : Number(point.error) })),
  };
}

export async function getForecastOverview(organizationId: string) {
  const runs = await prisma.forecastRun.findMany({ where: { organizationId }, orderBy: { generatedAt: "desc" }, take: 100, select: { id: true, productId: true, quality: true, selectedMethod: true, mae: true, rmse: true, generatedAt: true, product: { select: { name: true, sku: true } }, warehouse: { select: { name: true } } } });
  const qualityCounts = ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT_DATA"].map((quality) => ({ quality, count: runs.filter((run) => run.quality === quality).length }));
  const scored = runs.filter((run) => run.mae !== null && run.rmse !== null);
  return {
    forecastableProducts: new Set(runs.filter((run) => run.quality !== "INSUFFICIENT_DATA").map((run) => run.productId)).size,
    insufficientData: new Set(runs.filter((run) => run.quality === "INSUFFICIENT_DATA").map((run) => run.productId)).size,
    highQualityForecasts: runs.filter((run) => run.quality === "HIGH").length,
    averageMae: scored.length ? scored.reduce((sum, run) => sum + asNumber(run.mae), 0) / scored.length : null,
    averageRmse: scored.length ? scored.reduce((sum, run) => sum + asNumber(run.rmse), 0) / scored.length : null,
    forecastRuns: runs.length,
    qualityDistribution: qualityCounts,
    recentRuns: runs.slice(0, 10).map((run) => ({ ...run, mae: run.mae === null ? null : Number(run.mae), rmse: run.rmse === null ? null : Number(run.rmse) })),
  };
}

export async function getProductForecast(organizationId: string, productId: string, filters: ForecastFilters = {}) {
  const product = await getProduct(organizationId, productId);
  const warehouseId = filters.warehouseId;
  if (warehouseId) await getWarehouse(organizationId, warehouseId);
  const series = await getSeries(organizationId, productId, warehouseId);
  const run = await prisma.forecastRun.findFirst({ where: { organizationId, productId, ...(warehouseId ? { warehouseId } : {}) }, orderBy: { generatedAt: "desc" }, include: { product: true, warehouse: true, points: { orderBy: [{ pointType: "asc" }, { forecastDate: "asc" }] } } });
  return {
    product: { id: product.id, name: product.name, sku: product.sku, unit: product.unit, preferredSupplier: product.preferredSupplier },
    warehouse: warehouseId ? product.inventoryLevels.find((level) => level.warehouseId === warehouseId)?.warehouse ?? null : null,
    warehouses: product.inventoryLevels.map((level) => level.warehouse),
    historical: series.observations,
    run: run ? serializeRun(run) : null,
    explanation: run ? `${run.quality} quality because ${run.qualityReason}` : "No forecast has been generated for this product yet. Generate one to compare candidate methods and historical error.",
  };
}

export async function getForecastRuns(organizationId: string, filters: ForecastFilters = {}) {
  const { page, pageSize, skip } = pageInfo(filters);
  const where: Prisma.ForecastRunWhereInput = { organizationId, ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}) };
  const [runs, total] = await Promise.all([
    prisma.forecastRun.findMany({ where, include: { product: true, warehouse: true, points: { orderBy: { forecastDate: "asc" } } }, orderBy: { generatedAt: "desc" }, skip, take: pageSize }),
    prisma.forecastRun.count({ where }),
  ]);
  return { items: runs.map(serializeRun), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getForecastPerformance(organizationId: string) {
  const runs = await prisma.forecastRun.findMany({ where: { organizationId }, select: { quality: true, selectedMethod: true, mae: true, rmse: true, mape: true, evaluationPeriod: true, observationCount: true } });
  const scored = runs.filter((run) => run.mae !== null && run.rmse !== null);
  const methods = [...new Set(runs.map((run) => run.selectedMethod))].map((method) => ({ method, runs: runs.filter((run) => run.selectedMethod === method).length, averageMae: runs.filter((run) => run.selectedMethod === method && run.mae !== null).reduce((sum, run) => sum + asNumber(run.mae), 0) }));
  return { runs: runs.length, scoredRuns: scored.length, averageMae: scored.length ? scored.reduce((sum, run) => sum + asNumber(run.mae), 0) / scored.length : null, averageRmse: scored.length ? scored.reduce((sum, run) => sum + asNumber(run.rmse), 0) / scored.length : null, averageMape: runs.filter((run) => run.mape !== null).length ? runs.filter((run) => run.mape !== null).reduce((sum, run) => sum + asNumber(run.mape), 0) / runs.filter((run) => run.mape !== null).length : null, methods };
}