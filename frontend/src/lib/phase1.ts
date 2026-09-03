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