export type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

export type ListResult<T> = { items: T[]; pagination: Pagination };

export type Product = {
  id: string; sku: string; name: string; description?: string | null; unit: string;
  purchasePrice: number | string; sellingPrice: number | string; minimumStock: number;
  safetyStock: number; isActive: boolean; category?: { id: string; name: string } | null;
  preferredSupplier?: { id: string; name: string } | null;
  categoryId?: string | null; preferredSupplierId?: string | null;
};

export type Category = { id: string; name: string; _count?: { products: number } };
export type Contact = { id: string; name: string; email?: string | null; phone?: string | null; address?: string | null; wilaya?: string | null; isActive?: boolean; averageLeadTime?: number | null };
export type Warehouse = { id: string; name: string; code: string; location?: string | null; wilaya?: string | null; capacity?: number | null; isActive: boolean };
export type InventoryItem = {
  id: string; productId: string; warehouseId: string; onHandQuantity: number;
  reservedQuantity: number; availableQuantity: number; inventoryValue: number;
  product: Product & { category?: Category | null }; warehouse: Warehouse;
};
export type InventoryTransaction = {
  id: string; productId: string; warehouseId: string; quantity: number; type: string;
  reason?: string | null; referenceType?: string | null; referenceId?: string | null;
  createdAt: string; product: Product; warehouse: Warehouse;
  actor?: { firstName: string; lastName: string };
};
export type PurchaseItem = { id: string; productId: string; orderedQuantity: number; receivedQuantity: number; purchaseUnitPrice: number | string; product: Product };
export type PurchaseOrder = {
  id: string; orderNumber: string; status: string; orderDate: string; expectedDeliveryDate?: string | null;
  notes?: string | null; supplier: Contact; warehouse: Warehouse; items: PurchaseItem[];
};
export type SalesItem = { id: string; productId: string; quantity: number; sellingUnitPrice: number | string; product: Product };
export type SalesOrder = { id: string; orderNumber: string; status: string; orderDate: string; notes?: string | null; customer: Contact; warehouse: Warehouse; items: SalesItem[] };
export type Transfer = {
  id: string; status: string; notes?: string | null; createdAt: string;
  sourceWarehouse: Warehouse; destinationWarehouse: Warehouse;
  actor?: { firstName: string; lastName: string };
  items: { id: string; productId: string; quantity: number; product: Product }[];
};

export const asNumber = (value: number | string | null | undefined) => Number(value ?? 0);

export type HealthMetric = {
  productId: string; productName: string; sku: string; warehouseId: string; warehouseName: string;
  categoryName?: string | null; supplierName?: string | null; onHandQuantity: number; reservedQuantity: number;
  availableQuantity: number; inventoryValue: number; averageDailyDemand: number; averageWeeklyDemand: number;
  daysOfInventory: number | null; turnover: number | null; stockAgeDays: number | null; stockAgeBucket: string;
  health: string; slowMoving: string; overstockLevel: string; overstockScore: number; riskScore: number;
  riskLevel: string; trendPercent: number | null; sufficientData: boolean; leadTimeDays: number | null;
  safetyStock: number; reorderPoint: number | null; targetStock: number | null; recommendedQuantity: number; reason: string;
};

export type IntelligenceOverview = {
  period: { start: string; end: string; days: number };
  kpis: { inventoryValue: number; stockoutRiskProducts: number; excessInventoryProducts: number; slowMovingProducts: number; healthyInventoryPercent: number; openRecommendations: number; openAlerts: number };
  healthDistribution: { health: string; count: number }[];
  stockoutRisk: HealthMetric[]; excessInventory: HealthMetric[]; topInventoryValue: HealthMetric[];
  abc: { productId: string; productName: string; sku: string; revenue: number; units: number; contributionPercent: number; cumulativePercent: number; classification: string }[];
  suppliers: SupplierIntelligence[]; warehouses: WarehouseIntelligence[];
  demandTrend: { productId: string; productName: string; trendPercent: number | null; averageDailyDemand: number }[];
};
export type SupplierIntelligence = { id: string; name: string; wilaya?: string | null; averageLeadTime: number | null; configuredLeadTime: number | null; onTimeRate: number | null; lateDeliveryRate: number | null; averageDelay: number | null; totalPurchaseVolume: number; purchaseOrderCount: number; partialDeliveryRate: number | null; performanceScore: number | null; explanation: string };
export type WarehouseIntelligence = { id: string; name: string; inventoryValue: number; activeProducts: number; riskProducts: number; excessProducts: number; totalOnHandUnits: number; healthScore: number };
export type Recommendation = { id: string; priority: string; status: string; riskLevel: string; recommendedQuantity: number; reorderPoint: number; targetStock: number; currentAvailable: number; averageDailyDemand: number | string; leadTimeDays: number | null; safetyStock: number; stockoutHorizonDays: number | string | null; reason: string; product: Product; warehouse: Warehouse };
export type IntelligenceAlert = { id: string; type: string; severity: string; status: string; title: string; message: string; recommendedAction?: string | null; createdAt: string; product?: Product | null; warehouse?: Warehouse | null; supplier?: Contact | null };