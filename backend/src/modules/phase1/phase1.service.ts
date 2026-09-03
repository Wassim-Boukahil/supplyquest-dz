import { Prisma, InventoryTransactionType, RoleName } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../middleware/errors.js";
import type {
  categoryCreateSchema, customerCreateSchema, productCreateSchema, purchaseCreateSchema,
  receiveSchema, salesCreateSchema, stockSchema, supplierCreateSchema, transferCreateSchema,
  warehouseCreateSchema,
} from "./phase1.schemas.js";
import type { z } from "zod";

type Tx = Prisma.TransactionClient;
type ListQuery = { search?: string; page?: string; pageSize?: string; active?: string; warehouseId?: string; productId?: string; categoryId?: string; type?: string };
type CategoryInput = z.infer<typeof categoryCreateSchema>;
type ProductInput = z.infer<typeof productCreateSchema>;
type SupplierInput = z.infer<typeof supplierCreateSchema>;
type CustomerInput = z.infer<typeof customerCreateSchema>;
type WarehouseInput = z.infer<typeof warehouseCreateSchema>;
type PurchaseInput = z.infer<typeof purchaseCreateSchema>;
type ReceiveInput = z.infer<typeof receiveSchema>;
type SalesInput = z.infer<typeof salesCreateSchema>;
type StockInput = z.infer<typeof stockSchema>;
type TransferInput = z.infer<typeof transferCreateSchema>;

function queryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function paging(query: ListQuery) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function notFound(label: string): never {
  throw new AppError("NOT_FOUND", `${label} not found.`, 404);
}

async function requireEntity(model: any, id: string, organizationId: string, label: string) {
  const entity = await model.findFirst({ where: { id, organizationId } });
  if (!entity) notFound(label);
  return entity;
}

async function requireReferences(organizationId: string, ids: { categoryId?: string; supplierId?: string; customerId?: string; warehouseId?: string; productIds?: string[] }) {
  if (ids.categoryId && !(await prisma.productCategory.findFirst({ where: { id: ids.categoryId, organizationId } }))) notFound("Category");
  if (ids.supplierId && !(await prisma.supplier.findFirst({ where: { id: ids.supplierId, organizationId } }))) notFound("Supplier");
  if (ids.customerId && !(await prisma.customer.findFirst({ where: { id: ids.customerId, organizationId } }))) notFound("Customer");
  if (ids.warehouseId && !(await prisma.warehouse.findFirst({ where: { id: ids.warehouseId, organizationId } }))) notFound("Warehouse");
  if (ids.productIds?.length) {
    const products = await prisma.product.findMany({ where: { organizationId, id: { in: ids.productIds } }, select: { id: true } });
    if (products.length !== new Set(ids.productIds).size) notFound("Product");
  }
}

export async function listEntity(entity: "products" | "categories" | "suppliers" | "customers" | "warehouses", organizationId: string, query: ListQuery) {
  const { page, pageSize, skip } = paging(query);
  const search = queryValue(query.search);
  const active = queryValue(query.active);
  const common = { organizationId, ...(active === "true" ? { isActive: true } : active === "false" ? { isActive: false } : {}) };
  const contains = search ? { contains: search, mode: "insensitive" as const } : undefined;
  const configs: Record<string, { where: any; include?: any; orderBy?: any }> = {
    products: { where: { ...common, ...(search ? { OR: [{ name: contains }, { sku: contains }] } : {}), ...(query.categoryId ? { categoryId: query.categoryId } : {}) }, include: { category: true, preferredSupplier: true }, orderBy: { name: "asc" } },
    categories: { where: { organizationId, ...(search ? { name: contains } : {}) }, orderBy: { name: "asc" } },
    suppliers: { where: { ...common, ...(search ? { OR: [{ name: contains }, { email: contains }] } : {}) }, orderBy: { name: "asc" } },
    customers: { where: { ...common, ...(search ? { OR: [{ name: contains }, { email: contains }] } : {}) }, orderBy: { name: "asc" } },
    warehouses: { where: { ...common, ...(search ? { OR: [{ name: contains }, { code: contains }, { wilaya: contains }] } : {}) }, orderBy: { name: "asc" } },
  };
  const config = configs[entity];
  const model = (prisma as any)[entity === "categories" ? "productCategory" : entity.slice(0, -1)];
  const [items, total] = await Promise.all([model.findMany({ ...config, skip, take: pageSize }), model.count({ where: config.where })]);
  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getEntity(entity: "products" | "categories" | "suppliers" | "customers" | "warehouses", id: string, organizationId: string) {
  const model = (prisma as any)[entity === "categories" ? "productCategory" : entity.slice(0, -1)];
  const include = entity === "products"
    ? { category: true, preferredSupplier: true, inventoryLevels: { include: { warehouse: true } }, inventoryTransactions: { orderBy: { createdAt: "desc" as const }, take: 20, include: { warehouse: true, actor: { select: { firstName: true, lastName: true } } } } }
    : undefined;
  const result = await model.findFirst({ where: { id, organizationId }, ...(include ? { include } : {}) });
  if (!result) notFound(entity === "categories" ? "Category" : entity.slice(0, -1));
  return result;
}

export async function createEntity(entity: "products" | "categories" | "suppliers" | "customers" | "warehouses", organizationId: string, input: CategoryInput | ProductInput | SupplierInput | CustomerInput | WarehouseInput) {
  if (entity === "products") {
    const product = input as ProductInput;
    await requireReferences(organizationId, { categoryId: product.categoryId || undefined, supplierId: product.preferredSupplierId || undefined });
  }
  const model = (prisma as any)[entity === "categories" ? "productCategory" : entity.slice(0, -1)];
  const data = { ...(input as any), organizationId, categoryId: (input as any).categoryId || undefined, preferredSupplierId: (input as any).preferredSupplierId || undefined };
  return model.create({ data });
}

export async function updateEntity(entity: "products" | "categories" | "suppliers" | "customers" | "warehouses", id: string, organizationId: string, input: Record<string, unknown>) {
  await getEntity(entity, id, organizationId);
  if (entity === "products") {
    await requireReferences(organizationId, { categoryId: String(input.categoryId || "") || undefined, supplierId: String(input.preferredSupplierId || "") || undefined });
  }
  const model = (prisma as any)[entity === "categories" ? "productCategory" : entity.slice(0, -1)];
  const data = { ...input, ...(Object.prototype.hasOwnProperty.call(input, "categoryId") ? { categoryId: input.categoryId || null } : {}), ...(Object.prototype.hasOwnProperty.call(input, "preferredSupplierId") ? { preferredSupplierId: input.preferredSupplierId || null } : {}) };
  return model.update({ where: { id }, data });
}

export async function setEntityActive(entity: "products" | "suppliers" | "customers" | "warehouses", id: string, organizationId: string, isActive: boolean) {
  await getEntity(entity, id, organizationId);
  const model = (prisma as any)[entity.slice(0, -1)];
  return model.update({ where: { id }, data: { isActive } });
}

export async function deleteCategory(id: string, organizationId: string) {
  await requireEntity(prisma.productCategory, id, organizationId, "Category");
  const used = await prisma.product.count({ where: { organizationId, categoryId: id } });
  if (used) throw new AppError("CATEGORY_IN_USE", "This category cannot be deleted while products use it.", 409);
  return prisma.productCategory.delete({ where: { id } });
}

async function inventoryLevel(tx: Tx, organizationId: string, productId: string, warehouseId: string) {
  return tx.inventoryLevel.upsert({
    where: { organizationId_productId_warehouseId: { organizationId, productId, warehouseId } },
    create: { organizationId, productId, warehouseId },
    update: {},
  });
}

async function changeStock(tx: Tx, organizationId: string, actorId: string, input: { productId: string; warehouseId: string; delta: number; type: InventoryTransactionType; referenceType?: string; referenceId?: string; reason?: string }) {
  const level = await inventoryLevel(tx, organizationId, input.productId, input.warehouseId);
  const next = level.onHandQuantity + input.delta;
  if (next < 0) throw new AppError("INSUFFICIENT_STOCK", "The available stock is insufficient for this operation.", 409);
  await tx.inventoryLevel.update({ where: { id: level.id }, data: { onHandQuantity: input.delta > 0 ? { increment: input.delta } : { decrement: Math.abs(input.delta) } } });
  return tx.inventoryTransaction.create({ data: { organizationId, productId: input.productId, warehouseId: input.warehouseId, quantity: Math.abs(input.delta), type: input.type, referenceType: input.referenceType, referenceId: input.referenceId, reason: input.reason, actorId } });
}

export async function listInventory(organizationId: string, query: ListQuery) {
  const { page, pageSize, skip } = paging(query);
  const search = queryValue(query.search);
  const where: any = { organizationId, ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}), ...(query.productId ? { productId: query.productId } : {}), ...(query.categoryId ? { product: { categoryId: query.categoryId } } : {}), ...(search ? { product: { OR: [{ name: { contains: search, mode: "insensitive" } }, { sku: { contains: search, mode: "insensitive" } }] } } : {}) };
  const [items, total] = await Promise.all([
    prisma.inventoryLevel.findMany({ where, include: { product: { include: { category: true } }, warehouse: true }, orderBy: { updatedAt: "desc" }, skip, take: pageSize }),
    prisma.inventoryLevel.count({ where }),
  ]);
  return { items: items.map((item) => ({ ...item, availableQuantity: item.onHandQuantity - item.reservedQuantity, inventoryValue: Number(item.product.purchasePrice) * item.onHandQuantity })), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function listTransactions(organizationId: string, query: ListQuery) {
  const { page, pageSize, skip } = paging(query);
  const where: any = { organizationId, ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}), ...(query.productId ? { productId: query.productId } : {}), ...(query.type ? { type: query.type } : {}) };
  const [items, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({ where, include: { product: true, warehouse: true, actor: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
    prisma.inventoryTransaction.count({ where }),
  ]);
  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function initialStock(organizationId: string, actorId: string, input: StockInput) {
  await requireReferences(organizationId, input);
  return prisma.$transaction(async (tx) => changeStock(tx, organizationId, actorId, { ...input, delta: input.quantity, type: InventoryTransactionType.INITIAL_STOCK, reason: input.reason }));
}

export async function adjustStock(organizationId: string, actorId: string, input: StockInput & { direction: "IN" | "OUT" }) {
  await requireReferences(organizationId, input);
  return prisma.$transaction(async (tx) => changeStock(tx, organizationId, actorId, { ...input, delta: input.direction === "IN" ? input.quantity : -input.quantity, type: input.direction === "IN" ? InventoryTransactionType.ADJUSTMENT_IN : InventoryTransactionType.ADJUSTMENT_OUT, reason: input.reason }));
}

function orderInclude(kind: "purchase" | "sales") {
  return kind === "purchase"
    ? { supplier: true, warehouse: true, items: { include: { product: true } } }
    : { customer: true, warehouse: true, items: { include: { product: true } } };
}

export async function listOrders(kind: "purchase" | "sales", organizationId: string, query: ListQuery) {
  const { page, pageSize, skip } = paging(query);
  const model: any = kind === "purchase" ? prisma.purchaseOrder : prisma.salesOrder;
  const where: any = { organizationId, ...(queryValue(query.search) ? { orderNumber: { contains: queryValue(query.search), mode: "insensitive" } } : {}) };
  const [items, total] = await Promise.all([model.findMany({ where, include: orderInclude(kind), orderBy: { orderDate: "desc" }, skip, take: pageSize }), model.count({ where })]);
  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getOrder(kind: "purchase" | "sales", id: string, organizationId: string) {
  const model: any = kind === "purchase" ? prisma.purchaseOrder : prisma.salesOrder;
  const order = await model.findFirst({ where: { id, organizationId }, include: orderInclude(kind) });
  if (!order) notFound(kind === "purchase" ? "Purchase order" : "Sales order");
  return order;
}

function orderNumber(prefix: string, organizationId: string) {
  return `${prefix}-${organizationId.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

export async function createPurchase(organizationId: string, input: PurchaseInput) {
  await requireReferences(organizationId, { supplierId: input.supplierId, warehouseId: input.warehouseId, productIds: input.items.map((item) => item.productId) });
  return prisma.purchaseOrder.create({ data: { organizationId, supplierId: input.supplierId, warehouseId: input.warehouseId, orderNumber: orderNumber("PO", organizationId), status: input.status, expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : undefined, notes: input.notes || undefined, items: { create: input.items.map((item) => ({ productId: item.productId, orderedQuantity: item.quantity, purchaseUnitPrice: item.unitPrice ?? 0 })) } }, include: orderInclude("purchase") });
}

export async function receivePurchase(id: string, organizationId: string, actorId: string, input: ReceiveInput) {
  const order = await getOrder("purchase", id, organizationId);
  if (order.status === "CANCELLED" || order.status === "RECEIVED") throw new AppError("INVALID_ORDER_STATUS", "This purchase order cannot receive more goods.", 409);
  const requested = new Map(input.items.map((item) => [item.itemId, item.quantity]));
  if (requested.size !== input.items.length || input.items.some((item) => !order.items.some((orderItem: { id: string }) => orderItem.id === item.itemId))) {
    throw new AppError("INVALID_RECEIPT_ITEM", "Every receipt line must belong to this purchase order and appear once.", 422);
  }
  for (const item of order.items) {
    const quantity = requested.get(item.id) || 0;
    if (quantity > item.orderedQuantity - item.receivedQuantity) throw new AppError("RECEIPT_EXCEEDS_ORDER", `Receipt for ${item.product.name} exceeds the remaining quantity.`, 409);
  }
  return prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      const quantity = requested.get(item.id) || 0;
      if (!quantity) continue;
      await changeStock(tx, organizationId, actorId, { productId: item.productId, warehouseId: order.warehouseId, delta: quantity, type: InventoryTransactionType.PURCHASE_RECEIPT, referenceType: "PURCHASE_ORDER", referenceId: order.id });
      await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQuantity: { increment: quantity } } });
    }
    const refreshed = await tx.purchaseOrder.findUnique({ where: { id: order.id }, include: { items: true } });
    const allReceived = refreshed?.items.every((item) => item.receivedQuantity >= item.orderedQuantity);
    const anyReceived = refreshed?.items.some((item) => item.receivedQuantity > 0);
    await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: allReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : order.status } });
    return tx.purchaseOrder.findUnique({ where: { id: order.id }, include: orderInclude("purchase") });
  });
}

export async function createSales(organizationId: string, input: SalesInput) {
  await requireReferences(organizationId, { customerId: input.customerId, warehouseId: input.warehouseId, productIds: input.items.map((item) => item.productId) });
  return prisma.salesOrder.create({ data: { organizationId, customerId: input.customerId, warehouseId: input.warehouseId, orderNumber: orderNumber("SO", organizationId), status: input.status, notes: input.notes || undefined, items: { create: input.items.map((item) => ({ productId: item.productId, quantity: item.quantity, sellingUnitPrice: item.unitPrice ?? 0 })) } }, include: orderInclude("sales") });
}

export async function completeSales(id: string, organizationId: string, actorId: string) {
  const order = await getOrder("sales", id, organizationId);
  if (order.status === "CANCELLED" || order.status === "COMPLETED") throw new AppError("INVALID_ORDER_STATUS", "This sales order cannot be completed.", 409);
  return prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      const level = await tx.inventoryLevel.findUnique({ where: { organizationId_productId_warehouseId: { organizationId, productId: item.productId, warehouseId: order.warehouseId } } });
      if (!level || level.onHandQuantity - level.reservedQuantity < item.quantity) throw new AppError("INSUFFICIENT_STOCK", `Insufficient available stock for ${item.product.name}.`, 409);
    }
    for (const item of order.items) await changeStock(tx, organizationId, actorId, { productId: item.productId, warehouseId: order.warehouseId, delta: -item.quantity, type: InventoryTransactionType.SALE, referenceType: "SALES_ORDER", referenceId: order.id });
    return tx.salesOrder.update({ where: { id: order.id }, data: { status: "COMPLETED" }, include: orderInclude("sales") });
  });
}

export async function listTransfers(organizationId: string, query: ListQuery) {
  const { page, pageSize, skip } = paging(query);
  const [items, total] = await Promise.all([
    prisma.inventoryTransfer.findMany({ where: { organizationId }, include: { sourceWarehouse: true, destinationWarehouse: true, actor: { select: { firstName: true, lastName: true } }, items: { include: { product: true } } }, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
    prisma.inventoryTransfer.count({ where: { organizationId } }),
  ]);
  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getTransfer(id: string, organizationId: string) {
  const transfer = await prisma.inventoryTransfer.findFirst({ where: { id, organizationId }, include: { sourceWarehouse: true, destinationWarehouse: true, actor: { select: { firstName: true, lastName: true } }, items: { include: { product: true } } } });
  if (!transfer) notFound("Transfer");
  return transfer;
}

export async function createTransfer(organizationId: string, actorId: string, input: TransferInput) {
  if (input.sourceWarehouseId === input.destinationWarehouseId) throw new AppError("INVALID_TRANSFER", "Source and destination warehouses must be different.", 422);
  await requireReferences(organizationId, { warehouseId: input.sourceWarehouseId });
  await requireReferences(organizationId, { warehouseId: input.destinationWarehouseId, productIds: input.items.map((item) => item.productId) });
  return prisma.inventoryTransfer.create({ data: { organizationId, sourceWarehouseId: input.sourceWarehouseId, destinationWarehouseId: input.destinationWarehouseId, actorId, notes: input.notes || undefined, items: { create: input.items.map((item) => ({ productId: item.productId, quantity: item.quantity })) } }, include: { sourceWarehouse: true, destinationWarehouse: true, items: { include: { product: true } } } });
}

export async function completeTransfer(id: string, organizationId: string, actorId: string) {
  const transfer = await getTransfer(id, organizationId);
  if (transfer.status !== "PENDING") throw new AppError("INVALID_TRANSFER_STATUS", "This transfer is no longer pending.", 409);
  return prisma.$transaction(async (tx) => {
    for (const item of transfer.items) {
      const level = await tx.inventoryLevel.findUnique({ where: { organizationId_productId_warehouseId: { organizationId, productId: item.productId, warehouseId: transfer.sourceWarehouseId } } });
      if (!level || level.onHandQuantity - level.reservedQuantity < item.quantity) throw new AppError("INSUFFICIENT_STOCK", `Insufficient stock for ${item.product.name}.`, 409);
    }
    for (const item of transfer.items) {
      await changeStock(tx, organizationId, actorId, { productId: item.productId, warehouseId: transfer.sourceWarehouseId, delta: -item.quantity, type: InventoryTransactionType.TRANSFER_OUT, referenceType: "INVENTORY_TRANSFER", referenceId: transfer.id });
      await changeStock(tx, organizationId, actorId, { productId: item.productId, warehouseId: transfer.destinationWarehouseId, delta: item.quantity, type: InventoryTransactionType.TRANSFER_IN, referenceType: "INVENTORY_TRANSFER", referenceId: transfer.id });
    }
    return tx.inventoryTransfer.update({ where: { id: transfer.id }, data: { status: "COMPLETED" }, include: { sourceWarehouse: true, destinationWarehouse: true, items: { include: { product: true } } } });
  });
}

export async function cancelTransfer(id: string, organizationId: string) {
  const transfer = await getTransfer(id, organizationId);
  if (transfer.status !== "PENDING") throw new AppError("INVALID_TRANSFER_STATUS", "Only pending transfers can be cancelled.", 409);
  return prisma.inventoryTransfer.update({ where: { id: transfer.id }, data: { status: "CANCELLED" } });
}

export const readableRoles = [RoleName.ADMIN, RoleName.MANAGER, RoleName.PURCHASER, RoleName.ANALYST, RoleName.OPERATOR] as const;