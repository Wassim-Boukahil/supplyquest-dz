import { AlertStatus, ForecastQuality, Prisma, RecommendationPriority, RecommendationStatus } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../middleware/errors.js";
import * as intelligence from "../intelligence/intelligence.service.js";

export type ExecutiveFilters = intelligence.IntelligenceFilters & { search?: string; priority?: string };

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const average = (values: number[], fallback = 100) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
const money = (value: unknown) => Number(value ?? 0);

async function salesSnapshot(organizationId: string, start: Date, end: Date) {
  const orders = await prisma.salesOrder.findMany({
    where: { organizationId, status: "COMPLETED", orderDate: { gte: start, lte: end } },
    select: { orderDate: true, items: { select: { quantity: true, sellingUnitPrice: true, product: { select: { id: true, name: true, category: { select: { name: true } } } } } } },
  });
  const byDay = new Map<string, { revenue: number; units: number }>();
  const products = new Map<string, { id: string; name: string; revenue: number; units: number }>();
  const categories = new Map<string, number>();
  let revenue = 0;
  let units = 0;
  for (const order of orders) {
    const key = order.orderDate.toISOString().slice(0, 10);
    const day = byDay.get(key) ?? { revenue: 0, units: 0 };
    for (const item of order.items) {
      const itemRevenue = item.quantity * money(item.sellingUnitPrice);
      revenue += itemRevenue;
      units += item.quantity;
      day.revenue += itemRevenue;
      day.units += item.quantity;
      const current = products.get(item.product.id) ?? { id: item.product.id, name: item.product.name, revenue: 0, units: 0 };
      current.revenue += itemRevenue;
      current.units += item.quantity;
      products.set(item.product.id, current);
      const category = item.product.category?.name ?? "Uncategorized";
      categories.set(category, (categories.get(category) ?? 0) + itemRevenue);
    }
    byDay.set(key, day);
  }
  return {
    revenue,
    orders: orders.length,
    units,
    averageOrderValue: orders.length ? revenue / orders.length : 0,
    trend: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({ date, ...values })),
    topProducts: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    categories: [...categories.entries()].map(([name, value]) => ({ name, revenue: value, share: revenue ? value / revenue * 100 : 0 })).sort((a, b) => b.revenue - a.revenue),
  };
}

function healthBreakdown(overview: Awaited<ReturnType<typeof intelligence.getOverview>>, forecastQualities: string[], alertCounts: { critical: number; high: number }) {
  const totalSignals = overview.healthDistribution.reduce((sum, item) => sum + item.count, 0);
  const inventoryHealth = clamp(average(overview.stockoutRisk.length || totalSignals ? overview.stockoutRisk.length ? overview.stockoutRisk.map((row) => 100 - row.riskScore) : [overview.kpis.healthyInventoryPercent] : [], overview.kpis.healthyInventoryPercent));
  const supplyRisk = clamp(100 - (overview.kpis.stockoutRiskProducts / Math.max(1, totalSignals)) * 100);
  const supplierHealth = clamp(average(overview.suppliers.filter((supplier) => supplier.performanceScore !== null).map((supplier) => supplier.performanceScore as number)));
  const qualityScore: Record<string, number> = { HIGH: 100, MEDIUM: 75, LOW: 45, INSUFFICIENT_DATA: 25 };
  const forecastQuality = clamp(average(forecastQualities.map((quality) => qualityScore[quality] ?? 25)));
  const operationalAlerts = clamp(100 - alertCounts.critical * 20 - alertCounts.high * 10);
  const score = clamp(average([inventoryHealth, supplyRisk, supplierHealth, forecastQuality, operationalAlerts]));
  return {
    score,
    operationalLevel: Math.max(1, Math.round(score / 7)),
    breakdown: { inventoryHealth, supplyRisk, supplierHealth, forecastQuality, operationalAlerts },
  };
}

export async function getExecutiveDashboard(organizationId: string, filters: ExecutiveFilters = {}) {
  const overview = await intelligence.getOverview(organizationId, filters);
  const start = new Date(overview.period.start);
  const end = new Date(overview.period.end);
  const [organization, sales, counts, forecasts, alertCounts] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    salesSnapshot(organizationId, start, end),
    Promise.all([
      prisma.product.count({ where: { organizationId, isActive: true } }),
      prisma.supplier.count({ where: { organizationId } }),
      prisma.warehouse.count({ where: { organizationId, isActive: true } }),
    ]),
    prisma.forecastRun.findMany({ where: { organizationId, generatedAt: { gte: start, lte: end } }, select: { quality: true } }),
    prisma.inventoryAlert.groupBy({ by: ["severity"], where: { organizationId, status: AlertStatus.OPEN }, _count: { _all: true } }),
  ]);
  const alerts = { critical: alertCounts.find((item) => item.severity === "CRITICAL")?._count._all ?? 0, high: alertCounts.find((item) => item.severity === "HIGH")?._count._all ?? 0 };
  const health = healthBreakdown(overview, forecasts.map((item) => item.quality), alerts);
  const attention = [
    ...overview.stockoutRisk.slice(0, 4).map((row) => ({ severity: row.riskLevel, entityType: "PRODUCT", entityId: row.productId, entity: row.productName, explanation: row.reason, impact: row.recommendedQuantity * row.purchasePrice, action: row.recommendedQuantity ? `Review replenishment for ${row.recommendedQuantity} units.` : "Review stock coverage.", href: `/intelligence/products/${row.productId}` })),
    ...overview.excessInventory.slice(0, 3).map((row) => ({ severity: "MEDIUM", entityType: "PRODUCT", entityId: row.productId, entity: row.productName, explanation: `${row.daysOfInventory?.toFixed(0) ?? "Extended"} days of coverage exceeds the 30-day target.`, impact: row.inventoryValue, action: "Review purchasing and warehouse allocation.", href: `/intelligence/products/${row.productId}` })),
    ...overview.suppliers.filter((supplier) => (supplier.performanceScore ?? 100) < 70).slice(0, 2).map((supplier) => ({ severity: "HIGH", entityType: "SUPPLIER", entityId: supplier.id, entity: supplier.name, explanation: supplier.explanation, impact: supplier.totalPurchaseVolume, action: "Review supplier commitments and lead-time assumptions.", href: `/suppliers/${supplier.id}` })),
  ].sort((a, b) => ({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[a.severity as "CRITICAL"] ?? 3) - ({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[b.severity as "CRITICAL"] ?? 3));
  return {
    organization: organization ?? { name: "Workspace" },
    period: overview.period,
    health,
    kpis: {
      revenue: sales.revenue,
      inventoryValue: overview.kpis.inventoryValue,
      stockoutRisk: overview.kpis.stockoutRiskProducts,
      excessInventory: overview.kpis.excessInventoryProducts,
      forecastQuality: health.breakdown.forecastQuality,
      openRecommendations: overview.kpis.openRecommendations,
      inventoryTurnover: overview.topInventoryValue.length ? average(overview.topInventoryValue.map((row) => row.turnover ?? 0), 0) : 0,
      activeProducts: counts[0],
      activeSuppliers: counts[1],
      activeWarehouses: counts[2],
      overdueAlerts: alerts.critical + alerts.high,
    },
    attention,
    decisionFeed: attention.slice(0, 8),
    sales,
    inventory: { healthDistribution: overview.healthDistribution, warehouses: overview.warehouses, topValue: overview.topInventoryValue.slice(0, 8) },
    suppliers: overview.suppliers,
    forecasts: { runs: forecasts.length, qualities: forecasts.map((item) => item.quality) },
  };
}

export async function getAnalytics(organizationId: string, filters: ExecutiveFilters = {}) {
  const dashboard = await getExecutiveDashboard(organizationId, filters);
  return {
    period: dashboard.period,
    filters: { warehouseId: filters.warehouseId ?? null, categoryId: filters.categoryId ?? null, supplierId: filters.supplierId ?? null, productId: filters.productId ?? null },
    sales: dashboard.sales,
    inventory: dashboard.inventory,
    suppliers: dashboard.suppliers,
    warehouses: dashboard.inventory.warehouses,
    demand: { trend: dashboard.decisionFeed.filter((item) => item.entityType === "PRODUCT") },
    forecasting: dashboard.forecasts,
    recommendations: { open: dashboard.kpis.openRecommendations, feed: dashboard.decisionFeed },
  };
}

async function syncQuests(organizationId: string, filters: ExecutiveFilters = {}) {
  const dashboard = await getExecutiveDashboard(organizationId, filters);
  const recommendations = await intelligence.getRecommendations(organizationId, { ...filters, page: "1", pageSize: "100" });
  const alerts = await intelligence.getAlerts(organizationId, { ...filters, page: "1", pageSize: "100", status: "OPEN" });
  for (const item of recommendations.items) {
    await prisma.supplyQuest.upsert({
      where: { organizationId_fingerprint: { organizationId, fingerprint: `recommendation:${item.id}` } },
      create: {
        organizationId, fingerprint: `recommendation:${item.id}`, title: `Prevent ${item.product.name} stockout`,
        explanation: item.reason, priority: item.priority, entityType: "RECOMMENDATION", productId: item.product.id, warehouseId: item.warehouse.id,
        recommendationId: item.id, reason: item.reason, businessImpact: money(item.estimatedImpact), recommendedAction: `Place a purchase order for ${item.recommendedQuantity} units.`,
      },
      update: { explanation: item.reason, priority: item.priority, reason: item.reason, businessImpact: money(item.estimatedImpact), recommendedAction: `Place a purchase order for ${item.recommendedQuantity} units.` },
    });
  }
  for (const item of alerts.items) {
    await prisma.supplyQuest.upsert({
      where: { organizationId_fingerprint: { organizationId, fingerprint: `alert:${item.id}` } },
      create: {
        organizationId, fingerprint: `alert:${item.id}`, title: item.title, explanation: item.message, priority: item.severity as RecommendationPriority,
        entityType: item.supplier ? "SUPPLIER" : item.warehouse ? "WAREHOUSE" : "PRODUCT", productId: item.product?.id, warehouseId: item.warehouse?.id, supplierId: item.supplier?.id,
        reason: item.message, businessImpact: null, recommendedAction: item.recommendedAction ?? "Review this operational signal.",
      },
      update: { explanation: item.message, priority: item.severity as RecommendationPriority, reason: item.message, recommendedAction: item.recommendedAction ?? "Review this operational signal." },
    });
  }
  return dashboard;
}

export async function listQuests(organizationId: string, query: ExecutiveFilters = {}) {
  await syncQuests(organizationId, query);
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 24));
  const where: Prisma.SupplyQuestWhereInput = {
    organizationId,
    ...(query.status ? { status: query.status as RecommendationStatus } : {}),
    ...(query.priority ? { priority: query.priority as RecommendationPriority } : {}),
    ...(query.search ? { OR: [{ title: { contains: query.search, mode: "insensitive" } }, { explanation: { contains: query.search, mode: "insensitive" } }, { reason: { contains: query.search, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.supplyQuest.findMany({ where, include: { product: true, warehouse: true, supplier: true, recommendation: true }, orderBy: [{ status: "asc" }, { priority: "asc" }, { updatedAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.supplyQuest.count({ where }),
  ]);
  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function updateQuest(id: string, organizationId: string, status: RecommendationStatus) {
  const existing = await prisma.supplyQuest.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError("NOT_FOUND", "Supply Quest not found.", 404);
  return prisma.supplyQuest.update({ where: { id }, data: { status, completedAt: status === RecommendationStatus.COMPLETED ? new Date() : null }, include: { product: true, warehouse: true, supplier: true, recommendation: true } });
}