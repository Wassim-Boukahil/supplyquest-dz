import { AlertSeverity, AlertStatus, AlertType, Prisma, RecommendationPriority, RecommendationStatus } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../middleware/errors.js";

const DAY = 86_400_000;
const DEFAULT_DAYS = 90;
const RECENT_DAYS = 14;
const REVIEW_DAYS = 14;

export type IntelligenceFilters = {
  startDate?: string;
  endDate?: string;
  warehouseId?: string;
  categoryId?: string;
  productId?: string;
  supplierId?: string;
  page?: string;
  pageSize?: string;
  status?: string;
  severity?: string;
  period?: string;
};

type ProductRecord = Awaited<ReturnType<typeof loadData>>["products"][number];
type InventoryRecord = ProductRecord["inventoryLevels"][number];
type SaleTransaction = Awaited<ReturnType<typeof loadData>>["transactions"][number];

export type DemandMetrics = {
  totalUnitsSold: number;
  averageDailyDemand: number;
  averageWeeklyDemand: number;
  recentUnitsSold: number;
  recentDailyDemand: number;
  baselineDailyDemand: number;
  trendPercent: number | null;
  volatility: number | null;
  salesCount: number;
  historyDays: number;
  sufficientData: boolean;
};

export type HealthMetric = {
  productId: string;
  categoryId: string | null;
  purchasePrice: number;
  productName: string;
  sku: string;
  warehouseId: string;
  warehouseName: string;
  categoryName: string | null;
  supplierName: string | null;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  inventoryValue: number;
  averageDailyDemand: number;
  averageWeeklyDemand: number;
  daysOfInventory: number | null;
  turnover: number | null;
  stockAgeDays: number | null;
  stockAgeBucket: string;
  health: "CRITICAL" | "LOW" | "HEALTHY" | "EXCESS" | "INSUFFICIENT";
  slowMoving: "FAST" | "NORMAL" | "SLOW" | "DEAD" | "INSUFFICIENT";
  overstockLevel: "NONE" | "WATCH" | "EXCESS" | "INSUFFICIENT";
  overstockScore: number;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  trendPercent: number | null;
  sufficientData: boolean;
  leadTimeDays: number | null;
  safetyStock: number;
  reorderPoint: number | null;
  targetStock: number | null;
  recommendedQuantity: number;
  reason: string;
};

function number(value: unknown) {
  return Number(value ?? 0);
}

function parseDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function dateRange(filters: IntelligenceFilters) {
  const end = parseDate(filters.endDate, new Date());
  const requestedDays = Number(filters.period);
  const analysisDays = Number.isFinite(requestedDays) && requestedDays > 0 ? Math.min(3650, requestedDays) : DEFAULT_DAYS;
  const startFallback = new Date(end.getTime() - analysisDays * DAY);
  const start = parseDate(filters.startDate, startFallback);
  return start <= end ? { start, end, days: Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY)) } : { start: startFallback, end, days: analysisDays };
}

function paging(filters: IntelligenceFilters) {
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 25));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

async function loadData(organizationId: string, filters: IntelligenceFilters = {}) {
  const { start, end } = dateRange(filters);
  const products = await prisma.product.findMany({
    where: {
      organizationId,
      isActive: true,
      ...(filters.productId ? { id: filters.productId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.supplierId ? { preferredSupplierId: filters.supplierId } : {}),
    },
    include: {
      category: true,
      preferredSupplier: true,
      inventoryLevels: {
        where: filters.warehouseId ? { warehouseId: filters.warehouseId } : undefined,
        include: { warehouse: true },
      },
    },
    orderBy: { name: "asc" },
  });
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      organizationId,
      type: "SALE",
      createdAt: { lte: end },
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
    },
    select: { productId: true, warehouseId: true, quantity: true, createdAt: true },
  });
  const inboundTransactions = await prisma.inventoryTransaction.findMany({
    where: {
      organizationId,
      type: { in: ["INITIAL_STOCK", "PURCHASE_RECEIPT", "CUSTOMER_RETURN", "ADJUSTMENT_IN", "TRANSFER_IN"] },
      createdAt: { lte: end },
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
    },
    select: { productId: true, warehouseId: true, quantity: true, createdAt: true },
  });
  return { products, transactions, inboundTransactions, start, end };
}

function salesForProduct(transactions: SaleTransaction[], productId: string) {
  return transactions.filter((transaction) => transaction.productId === productId);
}

function demandMetrics(transactions: SaleTransaction[], productId: string, start: Date, end: Date): DemandMetrics {
  const sales = salesForProduct(transactions, productId).filter((sale) => sale.createdAt >= start && sale.createdAt <= end);
  const totalUnitsSold = sales.reduce((total, sale) => total + sale.quantity, 0);
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY));
  const recentStart = new Date(end.getTime() - RECENT_DAYS * DAY);
  const baselineStart = new Date(end.getTime() - RECENT_DAYS * 2 * DAY);
  const recentUnitsSold = sales.filter((sale) => sale.createdAt >= recentStart).reduce((total, sale) => total + sale.quantity, 0);
  const baselineUnitsSold = sales.filter((sale) => sale.createdAt >= baselineStart && sale.createdAt < recentStart).reduce((total, sale) => total + sale.quantity, 0);
  const recentDailyDemand = recentUnitsSold / RECENT_DAYS;
  const baselineDailyDemand = baselineUnitsSold / RECENT_DAYS;
  const daily = new Map<string, number>();
  for (const sale of sales) {
    const key = sale.createdAt.toISOString().slice(0, 10);
    daily.set(key, (daily.get(key) ?? 0) + sale.quantity);
  }
  const dailyValues: number[] = [];
  for (let cursor = new Date(start); cursor < end; cursor = new Date(cursor.getTime() + DAY)) {
    dailyValues.push(daily.get(cursor.toISOString().slice(0, 10)) ?? 0);
  }
  const dailyAverage = dailyValues.length ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length : totalUnitsSold / days;
  const variance = dailyValues.length ? dailyValues.reduce((sum, value) => sum + (value - dailyAverage) ** 2, 0) / dailyValues.length : 0;
  const historyDays = sales.length ? Math.max(1, Math.ceil((end.getTime() - Math.min(...sales.map((sale) => sale.createdAt.getTime()))) / DAY)) : 0;
  return {
    totalUnitsSold,
    averageDailyDemand: totalUnitsSold / days,
    averageWeeklyDemand: (totalUnitsSold / days) * 7,
    recentUnitsSold,
    recentDailyDemand,
    baselineDailyDemand,
    trendPercent: baselineDailyDemand > 0 ? ((recentDailyDemand - baselineDailyDemand) / baselineDailyDemand) * 100 : null,
    volatility: dailyValues.length && totalUnitsSold > 0 ? Math.sqrt(variance) : null,
    salesCount: sales.length,
    historyDays,
    sufficientData: days >= 14 && (historyDays >= 14 || sales.length >= 3),
  };
}

function classifyHealth(days: number | null, sufficientData: boolean, available: number, safetyStock: number): HealthMetric["health"] {
  if (!sufficientData && available > safetyStock) return "INSUFFICIENT";
  if (available <= 0 || (days !== null && days <= 7)) return "CRITICAL";
  if (days !== null && days <= 30) return "LOW";
  if (days !== null && days > 90) return "EXCESS";
  if (days === null) return sufficientData ? "EXCESS" : "INSUFFICIENT";
  return "HEALTHY";
}

function classifySlowMoving(demand: DemandMetrics): HealthMetric["slowMoving"] {
  if (!demand.sufficientData) return "INSUFFICIENT";
  if (demand.totalUnitsSold === 0) return "DEAD";
  if (demand.averageDailyDemand < 0.25) return "SLOW";
  if (demand.averageDailyDemand >= 5) return "FAST";
  return "NORMAL";
}

function stockAge(inbound: Awaited<ReturnType<typeof loadData>>["inboundTransactions"], productId: string, warehouseId: string, end: Date) {
  const rows = inbound.filter((row) => row.productId === productId && row.warehouseId === warehouseId);
  if (!rows.length) return { days: null, bucket: "UNKNOWN" };
  const weighted = rows.reduce((sum, row) => sum + row.quantity * Math.max(0, (end.getTime() - row.createdAt.getTime()) / DAY), 0);
  const quantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const days = Math.round(weighted / Math.max(1, quantity));
  return { days, bucket: days <= 30 ? "0–30 days" : days <= 60 ? "31–60 days" : days <= 90 ? "61–90 days" : "90+ days" };
}

function risk(available: number, demand: DemandMetrics, leadTimeDays: number | null, safetyStock: number) {
  const coverage = demand.averageDailyDemand > 0 ? available / demand.averageDailyDemand : null;
  let score = 0;
  if (available <= 0) score += 60;
  else if (coverage !== null && coverage <= 7) score += 40;
  else if (coverage !== null && coverage <= 14) score += 25;
  else if (coverage !== null && coverage <= 30) score += 10;
  if (leadTimeDays !== null && coverage !== null && coverage < leadTimeDays) score += 25;
  if (available <= safetyStock) score += 15;
  if ((demand.trendPercent ?? 0) >= 20) score += 10;
  score = Math.min(100, score);
  const riskLevel = score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";
  const reason = coverage === null
    ? demand.sufficientData ? "No current demand is recorded; monitor stock before reordering." : "Insufficient sales history to estimate stock coverage."
    : `${riskLevel === "LOW" ? "Stock is currently covered" : `${riskLevel[0]}${riskLevel.slice(1).toLowerCase()} risk`}: available stock covers approximately ${coverage.toFixed(1)} days${leadTimeDays !== null ? ` versus ${leadTimeDays} supplier lead-time days` : ""}.`;
  return { score, riskLevel: riskLevel as HealthMetric["riskLevel"], coverage, reason };
}

function overstock(days: number | null, demand: DemandMetrics, inventoryValue: number) {
  if (!demand.sufficientData && demand.totalUnitsSold === 0) return { score: 0, level: "INSUFFICIENT" as const, explanation: "Insufficient demand history to confirm excess inventory." };
  const score = days === null ? (inventoryValue > 0 ? 100 : 0) : Math.min(100, Math.max(0, Math.round(((days - 30) / 90) * 100)));
  const level = score >= 70 ? "EXCESS" : score >= 35 ? "WATCH" : "NONE";
  return { score, level: level as "NONE" | "WATCH" | "EXCESS", explanation: score > 0 ? `${level === "EXCESS" ? "Excess" : "Watch"} inventory: ${days ?? "no"} days of coverage versus a 30-day target.` : "Inventory is within the 30-day coverage target." };
}

function buildHealth(data: Awaited<ReturnType<typeof loadData>>): HealthMetric[] {
  const { start, end } = data;
  const rows: HealthMetric[] = [];
  for (const product of data.products) {
    const rawDemand = demandMetrics(data.transactions, product.id, start, end);
    const hasOlderInboundHistory = data.inboundTransactions.some((transaction) => transaction.productId === product.id && end.getTime() - transaction.createdAt.getTime() >= 14 * DAY);
    const demand = rawDemand.sufficientData || (rawDemand.totalUnitsSold === 0 && hasOlderInboundHistory) ? { ...rawDemand, sufficientData: true } : rawDemand;
    for (const level of product.inventoryLevels) {
      const availableQuantity = level.onHandQuantity - level.reservedQuantity;
      const inventoryValue = level.onHandQuantity * number(product.purchasePrice);
      const days = demand.averageDailyDemand > 0 ? availableQuantity / demand.averageDailyDemand : null;
      const leadTimeDays = product.preferredSupplier?.averageLeadTime ?? null;
      const riskMetric = risk(availableQuantity, demand, leadTimeDays, product.safetyStock);
      const excess = overstock(days, demand, inventoryValue);
      const age = stockAge(data.inboundTransactions, product.id, level.warehouseId, end);
      const reorderPoint = leadTimeDays !== null && demand.sufficientData ? Math.ceil(demand.averageDailyDemand * leadTimeDays + product.safetyStock) : null;
      const targetStock = reorderPoint !== null ? Math.ceil(reorderPoint + demand.averageDailyDemand * REVIEW_DAYS) : null;
      const recommendedQuantity = targetStock !== null && availableQuantity <= reorderPoint! ? Math.max(0, targetStock - availableQuantity) : 0;
      rows.push({
        productId: product.id, categoryId: product.categoryId, purchasePrice: number(product.purchasePrice), productName: product.name, sku: product.sku, warehouseId: level.warehouseId, warehouseName: level.warehouse.name,
        categoryName: product.category?.name ?? null, supplierName: product.preferredSupplier?.name ?? null,
        onHandQuantity: level.onHandQuantity, reservedQuantity: level.reservedQuantity, availableQuantity, inventoryValue,
        averageDailyDemand: demand.averageDailyDemand, averageWeeklyDemand: demand.averageWeeklyDemand, daysOfInventory: days,
        turnover: demand.totalUnitsSold > 0 && inventoryValue > 0 ? (demand.totalUnitsSold * number(product.purchasePrice)) / (Math.max(1, level.onHandQuantity + demand.totalUnitsSold / 2) * number(product.purchasePrice)) : demand.sufficientData ? 0 : null,
        stockAgeDays: age.days, stockAgeBucket: age.bucket, health: classifyHealth(days, demand.sufficientData, availableQuantity, product.safetyStock),
        slowMoving: classifySlowMoving(demand), overstockLevel: excess.level, overstockScore: excess.score, riskScore: riskMetric.score,
        riskLevel: riskMetric.riskLevel, trendPercent: demand.trendPercent, sufficientData: demand.sufficientData, leadTimeDays,
        safetyStock: product.safetyStock, reorderPoint, targetStock, recommendedQuantity, reason: riskMetric.reason,
      });
    }
  }
  return rows;
}

function filterRows(rows: HealthMetric[], filters: IntelligenceFilters) {
  return rows.filter((row) => (!filters.warehouseId || row.warehouseId === filters.warehouseId) && (!filters.productId || row.productId === filters.productId) && (!filters.categoryId || row.categoryId === filters.categoryId));
}

function paginated<T>(items: T[], filters: IntelligenceFilters) {
  const { page, pageSize, skip } = paging(filters);
  return { items: items.slice(skip, skip + pageSize), pagination: { page, pageSize, total: items.length, totalPages: Math.ceil(items.length / pageSize) } };
}

async function healthData(organizationId: string, filters: IntelligenceFilters = {}) {
  const data = await loadData(organizationId, filters);
  return { data, rows: filterRows(buildHealth(data), filters) };
}

function abcClassification(data: Awaited<ReturnType<typeof loadData>>, filters: IntelligenceFilters) {
  const { start, end } = data;
  const revenue = data.products.map((product) => {
    const demand = salesForProduct(data.transactions, product.id).filter((sale) => sale.createdAt >= start && sale.createdAt <= end);
    const units = demand.reduce((sum, sale) => sum + sale.quantity, 0);
    return { productId: product.id, productName: product.name, sku: product.sku, revenue: units * number(product.sellingPrice), units };
  }).sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = revenue.reduce((sum, row) => sum + row.revenue, 0);
  let cumulative = 0;
  return revenue.map((row) => {
    const contributionPercent = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
    cumulative += contributionPercent;
    return { ...row, contributionPercent, cumulativePercent: cumulative, classification: cumulative <= 80 || (cumulative - contributionPercent < 80 && row.revenue > 0) ? "A" : cumulative <= 95 ? "B" : "C" };
  }).filter((row) => !filters.productId || row.productId === filters.productId);
}

async function supplierMetrics(organizationId: string, filters: IntelligenceFilters = {}) {
  const { start, end } = dateRange(filters);
  const suppliers = await prisma.supplier.findMany({ where: { organizationId, ...(filters.supplierId ? { id: filters.supplierId } : {}) }, include: { purchaseOrders: { where: { orderDate: { gte: start, lte: end } }, include: { items: true } } }, orderBy: { name: "asc" } });
  const receipts = await prisma.inventoryTransaction.findMany({ where: { organizationId, type: "PURCHASE_RECEIPT", createdAt: { lte: end } }, select: { referenceId: true, createdAt: true, quantity: true } });
  return suppliers.map((supplier) => {
    const orders = supplier.purchaseOrders.filter((order) => order.status !== "CANCELLED");
    const details = orders.map((order) => {
      const orderReceipts = receipts.filter((receipt) => receipt.referenceId === order.id);
      const receivedAt = orderReceipts.length ? new Date(Math.max(...orderReceipts.map((receipt) => receipt.createdAt.getTime()))) : null;
      const totalOrdered = order.items.reduce((sum, item) => sum + item.orderedQuantity, 0);
      const totalReceived = order.items.reduce((sum, item) => sum + item.receivedQuantity, 0);
      const delay = receivedAt && order.expectedDeliveryDate ? Math.max(0, (receivedAt.getTime() - order.expectedDeliveryDate.getTime()) / DAY) : null;
      const lead = receivedAt ? Math.max(0, (receivedAt.getTime() - order.orderDate.getTime()) / DAY) : null;
      return { order, receivedAt, totalOrdered, totalReceived, delay, lead };
    });
    const completed = details.filter((detail) => detail.receivedAt);
    const onTime = completed.filter((detail) => detail.delay !== null && detail.delay <= 0).length;
    const onTimeRate = completed.length ? (onTime / completed.length) * 100 : null;
    const averageDelay = completed.length ? completed.reduce((sum, detail) => sum + (detail.delay ?? 0), 0) / completed.length : null;
    const averageLeadTime = completed.length ? completed.reduce((sum, detail) => sum + (detail.lead ?? 0), 0) / completed.length : null;
    const partialCount = details.filter((detail) => detail.totalReceived > 0 && detail.totalReceived < detail.totalOrdered).length;
    const fillRate = details.length ? details.reduce((sum, detail) => sum + Math.min(1, detail.totalReceived / Math.max(1, detail.totalOrdered)), 0) / details.length * 100 : null;
    const purchaseVolume = orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.orderedQuantity * number(item.purchaseUnitPrice), 0), 0);
    const score = onTimeRate === null ? null : Math.round(onTimeRate * 0.6 + Math.max(0, 100 - (averageDelay ?? 0) * 10) * 0.25 + (fillRate ?? 0) * 0.15);
    const explanation = score === null ? "Insufficient receiving history to score this supplier." : `Score ${score}: on-time delivery ${onTimeRate!.toFixed(0)}%, average delay ${(averageDelay ?? 0).toFixed(1)} days, and fill rate ${(fillRate ?? 0).toFixed(0)}%.`;
    return { id: supplier.id, name: supplier.name, wilaya: supplier.wilaya, averageLeadTime, configuredLeadTime: supplier.averageLeadTime, onTimeRate, lateDeliveryRate: onTimeRate === null ? null : 100 - onTimeRate, averageDelay, totalPurchaseVolume: purchaseVolume, purchaseOrderCount: orders.length, partialDeliveryRate: orders.length ? partialCount / orders.length * 100 : null, performanceScore: score, explanation };
  });
}

function recommendationPriority(row: HealthMetric): RecommendationPriority {
  return row.riskLevel === "CRITICAL" ? RecommendationPriority.CRITICAL : row.riskLevel === "HIGH" ? RecommendationPriority.HIGH : row.riskLevel === "MEDIUM" ? RecommendationPriority.MEDIUM : RecommendationPriority.LOW;
}

async function syncRecommendations(organizationId: string, rows: HealthMetric[]) {
  const candidates = rows.filter((row) => row.recommendedQuantity > 0 && row.reorderPoint !== null);
  for (const row of candidates) {
    const stockoutHorizon = row.averageDailyDemand > 0 ? row.availableQuantity / row.averageDailyDemand : null;
    await prisma.replenishmentRecommendation.upsert({
      where: { organizationId_productId_warehouseId: { organizationId, productId: row.productId, warehouseId: row.warehouseId } },
      create: { organizationId, productId: row.productId, warehouseId: row.warehouseId, fingerprint: `${row.productId}:${row.warehouseId}`, priority: recommendationPriority(row), riskLevel: row.riskLevel, recommendedQuantity: row.recommendedQuantity, reorderPoint: row.reorderPoint!, targetStock: row.targetStock!, currentAvailable: row.availableQuantity, averageDailyDemand: row.averageDailyDemand, leadTimeDays: row.leadTimeDays, safetyStock: row.safetyStock, estimatedImpact: row.recommendedQuantity * row.purchasePrice, stockoutHorizonDays: stockoutHorizon, reason: `Recommended order: ${row.recommendedQuantity} units. ${row.reason} Review-period target is ${row.targetStock} units.` },
      update: { priority: recommendationPriority(row), riskLevel: row.riskLevel, recommendedQuantity: row.recommendedQuantity, reorderPoint: row.reorderPoint!, targetStock: row.targetStock!, currentAvailable: row.availableQuantity, averageDailyDemand: row.averageDailyDemand, leadTimeDays: row.leadTimeDays, safetyStock: row.safetyStock, estimatedImpact: row.recommendedQuantity * row.purchasePrice, stockoutHorizonDays: stockoutHorizon, reason: `Recommended order: ${row.recommendedQuantity} units. ${row.reason} Review-period target is ${row.targetStock} units.` },
    });
  }
}

async function syncAlerts(organizationId: string, rows: HealthMetric[], suppliers: Awaited<ReturnType<typeof supplierMetrics>>) {
  const alerts: { fingerprint: string; type: AlertType; severity: AlertSeverity; title: string; message: string; action: string; productId?: string; warehouseId?: string; supplierId?: string }[] = [];
  for (const row of rows) {
    if (row.riskLevel === "CRITICAL" || row.riskLevel === "HIGH") alerts.push({ fingerprint: `stockout:${row.productId}:${row.warehouseId}`, type: row.availableQuantity <= 0 ? AlertType.CRITICAL_STOCK : AlertType.ESTIMATED_STOCKOUT, severity: row.riskLevel, title: `${row.productName} needs stock attention`, message: row.reason, action: row.recommendedQuantity ? `Review replenishment for ${row.recommendedQuantity} units.` : "Review stock and recent sales.", productId: row.productId, warehouseId: row.warehouseId });
    if (row.overstockLevel === "EXCESS") alerts.push({ fingerprint: `excess:${row.productId}:${row.warehouseId}`, type: AlertType.EXCESS_INVENTORY, severity: AlertSeverity.MEDIUM, title: `${row.productName} is overstocked`, message: `Inventory covers ${row.daysOfInventory?.toFixed(0) ?? "an extended number of"} days against a 30-day target.`, action: "Review purchasing and warehouse allocation.", productId: row.productId, warehouseId: row.warehouseId });
    if (row.slowMoving === "SLOW" || row.slowMoving === "DEAD") alerts.push({ fingerprint: `slow:${row.productId}:${row.warehouseId}`, type: AlertType.SLOW_MOVING, severity: row.slowMoving === "DEAD" ? AlertSeverity.MEDIUM : AlertSeverity.LOW, title: `${row.productName} is ${row.slowMoving.toLowerCase()}`, message: row.slowMoving === "DEAD" ? "No completed sales were recorded in the analysis window." : "Sales movement is below the slow-moving threshold.", action: "Review demand, pricing, and inventory aging.", productId: row.productId, warehouseId: row.warehouseId });
    if ((row.trendPercent ?? 0) >= 20) alerts.push({ fingerprint: `spike:${row.productId}`, type: AlertType.DEMAND_SPIKE, severity: AlertSeverity.HIGH, title: `Demand spike: ${row.productName}`, message: `Recent 14-day demand is ${(row.trendPercent ?? 0).toFixed(0)}% above the prior baseline.`, action: "Review safety stock and replenishment timing.", productId: row.productId });
    if ((row.trendPercent ?? 0) <= -20) alerts.push({ fingerprint: `decline:${row.productId}`, type: AlertType.DEMAND_DECLINE, severity: AlertSeverity.LOW, title: `Demand decline: ${row.productName}`, message: `Recent 14-day demand is ${Math.abs(row.trendPercent ?? 0).toFixed(0)}% below the prior baseline.`, action: "Review open purchase commitments and sales activity.", productId: row.productId });
  }
  for (const supplier of suppliers) {
    if (supplier.averageDelay !== null && supplier.averageDelay > 2) alerts.push({ fingerprint: `supplier-delay:${supplier.id}`, type: AlertType.SUPPLIER_DELAY, severity: supplier.averageDelay > 5 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM, title: `${supplier.name} has delivery delays`, message: `Average delivery delay is ${supplier.averageDelay.toFixed(1)} days across ${supplier.purchaseOrderCount} purchase orders.`, action: "Review supplier commitments and lead-time assumptions.", supplierId: supplier.id });
  }
  for (const alert of alerts) {
    await prisma.inventoryAlert.upsert({ where: { organizationId_fingerprint: { organizationId, fingerprint: alert.fingerprint } }, create: { organizationId, fingerprint: alert.fingerprint, type: alert.type, severity: alert.severity, title: alert.title, message: alert.message, recommendedAction: alert.action, productId: alert.productId, warehouseId: alert.warehouseId, supplierId: alert.supplierId }, update: { type: alert.type, severity: alert.severity, title: alert.title, message: alert.message, recommendedAction: alert.action, productId: alert.productId, warehouseId: alert.warehouseId, supplierId: alert.supplierId } });
  }
  return alerts;
}

export async function getOverview(organizationId: string, filters: IntelligenceFilters = {}) {
  const { rows, data } = await healthData(organizationId, filters);
  const suppliers = await supplierMetrics(organizationId, filters);
  const abc = abcClassification(data, filters);
  await syncRecommendations(organizationId, rows);
  await syncAlerts(organizationId, rows, suppliers);
  const byHealth = ["CRITICAL", "LOW", "HEALTHY", "EXCESS", "INSUFFICIENT"].map((health) => ({ health, count: rows.filter((row) => row.health === health).length }));
  return {
    period: { start: data.start, end: data.end, days: dateRange(filters).days },
    kpis: {
      inventoryValue: rows.reduce((sum, row) => sum + row.inventoryValue, 0),
      stockoutRiskProducts: rows.filter((row) => row.riskLevel === "HIGH" || row.riskLevel === "CRITICAL").length,
      excessInventoryProducts: rows.filter((row) => row.overstockLevel === "EXCESS").length,
      slowMovingProducts: rows.filter((row) => row.slowMoving === "SLOW" || row.slowMoving === "DEAD").length,
      healthyInventoryPercent: rows.length ? rows.filter((row) => row.health === "HEALTHY").length / rows.length * 100 : 0,
      openRecommendations: await prisma.replenishmentRecommendation.count({ where: { organizationId, status: { in: [RecommendationStatus.OPEN, RecommendationStatus.IN_PROGRESS] } } }),
      openAlerts: await prisma.inventoryAlert.count({ where: { organizationId, status: AlertStatus.OPEN } }),
    },
    healthDistribution: byHealth,
    stockoutRisk: rows.filter((row) => row.riskLevel === "HIGH" || row.riskLevel === "CRITICAL").sort((a, b) => b.riskScore - a.riskScore).slice(0, 8),
    excessInventory: rows.filter((row) => row.overstockLevel === "EXCESS").sort((a, b) => b.inventoryValue - a.inventoryValue).slice(0, 8),
    topInventoryValue: [...rows].sort((a, b) => b.inventoryValue - a.inventoryValue).slice(0, 8),
    abc: abc.slice(0, 8),
    suppliers: suppliers.slice(0, 8),
    warehouses: await getWarehousesFromRows(rows),
    demandTrend: rows.filter((row) => row.trendPercent !== null).sort((a, b) => Math.abs(b.trendPercent ?? 0) - Math.abs(a.trendPercent ?? 0)).slice(0, 8).map((row) => ({ productId: row.productId, productName: row.productName, trendPercent: row.trendPercent, averageDailyDemand: row.averageDailyDemand })),
  };
}

async function getWarehousesFromRows(rows: HealthMetric[]) {
  const byWarehouse = new Map<string, HealthMetric[]>();
  for (const row of rows) byWarehouse.set(row.warehouseId, [...(byWarehouse.get(row.warehouseId) ?? []), row]);
  return [...byWarehouse.entries()].map(([id, warehouseRows]) => ({ id, name: warehouseRows[0].warehouseName, inventoryValue: warehouseRows.reduce((sum, row) => sum + row.inventoryValue, 0), activeProducts: new Set(warehouseRows.map((row) => row.productId)).size, riskProducts: warehouseRows.filter((row) => row.riskLevel === "HIGH" || row.riskLevel === "CRITICAL").length, excessProducts: warehouseRows.filter((row) => row.overstockLevel === "EXCESS").length, totalOnHandUnits: warehouseRows.reduce((sum, row) => sum + row.onHandQuantity, 0), healthScore: warehouseRows.length ? Math.round(warehouseRows.reduce((sum, row) => sum + (100 - row.riskScore), 0) / warehouseRows.length) : 0 }));
}

export async function getInventoryHealth(organizationId: string, filters: IntelligenceFilters = {}) {
  const { rows } = await healthData(organizationId, filters);
  return paginated(rows, filters);
}

export async function getDemand(organizationId: string, filters: IntelligenceFilters = {}) {
  const { data, rows } = await healthData(organizationId, filters);
  return paginated(rows.map((row) => ({ productId: row.productId, productName: row.productName, sku: row.sku, totalUnitsSold: demandMetrics(data.transactions, row.productId, data.start, data.end).totalUnitsSold, averageDailyDemand: row.averageDailyDemand, averageWeeklyDemand: row.averageWeeklyDemand, recentDailyDemand: demandMetrics(data.transactions, row.productId, data.start, data.end).recentDailyDemand, trendPercent: row.trendPercent, demandVolatility: demandMetrics(data.transactions, row.productId, data.start, data.end).volatility, sufficientData: row.sufficientData })), filters);
}

export async function getAbc(organizationId: string, filters: IntelligenceFilters = {}) {
  const data = await loadData(organizationId, filters);
  return paginated(abcClassification(data, filters), filters);
}

export async function getSuppliers(organizationId: string, filters: IntelligenceFilters = {}) {
  return paginated(await supplierMetrics(organizationId, filters), filters);
}

export async function getWarehouses(organizationId: string, filters: IntelligenceFilters = {}) {
  const { rows } = await healthData(organizationId, filters);
  return paginated(await getWarehousesFromRows(rows), filters);
}

export async function getRecommendations(organizationId: string, filters: IntelligenceFilters = {}) {
  const { rows } = await healthData(organizationId, filters);
  await syncRecommendations(organizationId, rows);
  const { page, pageSize, skip } = paging(filters);
  const where: Prisma.ReplenishmentRecommendationWhereInput = { organizationId, ...(filters.status ? { status: filters.status as RecommendationStatus } : {}), ...(filters.productId ? { productId: filters.productId } : {}), ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}) };
  const [items, total] = await Promise.all([
    prisma.replenishmentRecommendation.findMany({ where, include: { product: true, warehouse: true }, orderBy: [{ priority: "asc" }, { updatedAt: "desc" }], skip, take: pageSize }),
    prisma.replenishmentRecommendation.count({ where }),
  ]);
  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function updateRecommendation(id: string, organizationId: string, status: RecommendationStatus) {
  const existing = await prisma.replenishmentRecommendation.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError("NOT_FOUND", "Recommendation not found.", 404);
  return prisma.replenishmentRecommendation.update({ where: { id }, data: { status }, include: { product: true, warehouse: true } });
}

export async function getAlerts(organizationId: string, filters: IntelligenceFilters = {}) {
  const { rows } = await healthData(organizationId, filters);
  const suppliers = await supplierMetrics(organizationId, filters);
  await syncAlerts(organizationId, rows, suppliers);
  const { page, pageSize, skip } = paging(filters);
  const where: Prisma.InventoryAlertWhereInput = { organizationId, ...(filters.status ? { status: filters.status as AlertStatus } : {}), ...(filters.severity ? { severity: filters.severity as AlertSeverity } : {}) };
  const [items, total] = await Promise.all([
    prisma.inventoryAlert.findMany({ where, include: { product: true, warehouse: true, supplier: true }, orderBy: [{ status: "asc" }, { severity: "asc" }, { createdAt: "desc" }], skip, take: pageSize }),
    prisma.inventoryAlert.count({ where }),
  ]);
  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function resolveAlert(id: string, organizationId: string) {
  const existing = await prisma.inventoryAlert.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError("NOT_FOUND", "Alert not found.", 404);
  return prisma.inventoryAlert.update({ where: { id }, data: { status: AlertStatus.RESOLVED, resolvedAt: new Date() }, include: { product: true, warehouse: true, supplier: true } });
}

export async function getProductIntelligence(id: string, organizationId: string, filters: IntelligenceFilters = {}) {
  const { rows, data } = await healthData(organizationId, { ...filters, productId: id, pageSize: "100" });
  if (!data.products.length) throw new AppError("NOT_FOUND", "Product not found.", 404);
  const product = data.products[0];
  const demand = demandMetrics(data.transactions, id, data.start, data.end);
  const abc = abcClassification(data, { ...filters, productId: id })[0] ?? null;
  return { product: { id: product.id, name: product.name, sku: product.sku, unit: product.unit, purchasePrice: product.purchasePrice, sellingPrice: product.sellingPrice, supplier: product.preferredSupplier }, demand, abc, inventory: rows, explanation: rows.some((row) => row.recommendedQuantity > 0) ? "WHY THIS REORDER IS RECOMMENDED: available stock is at or below the calculated reorder point. The recommendation combines average daily demand, supplier lead time, safety stock, and a 14-day review period." : rows.some((row) => row.riskLevel === "HIGH" || row.riskLevel === "CRITICAL") ? "WHY THIS PRODUCT IS AT RISK: current coverage and demand signals indicate stock could be depleted before replenishment arrives." : "This product is currently within the configured coverage and risk thresholds.", methodology: { inventoryValue: "on-hand quantity × purchase price", daysOfInventory: "available quantity ÷ average daily demand", reorderPoint: "average daily demand × supplier lead time + safety stock", targetStock: "reorder point + 14-day review-period demand", note: demand.sufficientData ? "Based on completed SALE transactions in the selected period." : "Insufficient history; demand-derived metrics are explicitly marked." } };
}

export async function getStockoutRisk(organizationId: string, filters: IntelligenceFilters = {}) {
  const { rows } = await healthData(organizationId, filters);
  return paginated(rows.sort((a, b) => b.riskScore - a.riskScore), filters);
}

export async function getOverstock(organizationId: string, filters: IntelligenceFilters = {}) {
  const { rows } = await healthData(organizationId, filters);
  return paginated(rows.filter((row) => row.overstockLevel !== "NONE"), filters);
}

export async function getSlowMoving(organizationId: string, filters: IntelligenceFilters = {}) {
  const { rows } = await healthData(organizationId, filters);
  return paginated(rows.filter((row) => row.slowMoving !== "NORMAL"), filters);
}
