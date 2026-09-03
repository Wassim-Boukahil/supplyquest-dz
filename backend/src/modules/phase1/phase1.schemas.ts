import { z } from "zod";

const id = z.string().uuid();
const nonNegativeInt = z.coerce.number().int().min(0);
const positiveInt = z.coerce.number().int().positive();
const money = z.coerce.number().min(0);
const optionalText = z.string().trim().max(500).optional().or(z.literal(""));

export const categoryCreateSchema = z.object({ name: z.string().trim().min(1).max(120) });
export const categoryUpdateSchema = categoryCreateSchema.partial();

const contactSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  address: optionalText,
  wilaya: z.string().trim().max(80).optional().or(z.literal("")),
});
export const supplierCreateSchema = contactSchema.extend({ averageLeadTime: nonNegativeInt.optional() });
export const supplierUpdateSchema = supplierCreateSchema.partial();
export const customerCreateSchema = contactSchema;
export const customerUpdateSchema = customerCreateSchema.partial();

export const warehouseCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().min(1).max(40),
  location: optionalText,
  wilaya: z.string().trim().max(80).optional().or(z.literal("")),
  capacity: positiveInt.optional(),
});
export const warehouseUpdateSchema = warehouseCreateSchema.partial();

export const productCreateSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  description: optionalText,
  unit: z.string().trim().min(1).max(40),
  purchasePrice: money,
  sellingPrice: money,
  minimumStock: nonNegativeInt.default(0),
  safetyStock: nonNegativeInt.default(0),
  categoryId: id.optional().or(z.literal("")),
  preferredSupplierId: id.optional().or(z.literal("")),
});
export const productUpdateSchema = productCreateSchema.partial();

const lineSchema = z.object({ productId: id, quantity: positiveInt, unitPrice: money.optional() });
export const purchaseCreateSchema = z.object({
  supplierId: id,
  warehouseId: id,
  expectedDeliveryDate: z.string().datetime().optional().or(z.literal("")),
  notes: optionalText,
  status: z.enum(["DRAFT", "ORDERED"]).default("DRAFT"),
  items: z.array(lineSchema).min(1),
});
export const receiveSchema = z.object({
  items: z.array(z.object({ itemId: id, quantity: positiveInt })).min(1),
});
export const salesCreateSchema = z.object({
  customerId: id,
  warehouseId: id,
  notes: optionalText,
  status: z.enum(["DRAFT", "CONFIRMED"]).default("DRAFT"),
  items: z.array(lineSchema).min(1),
});

export const stockSchema = z.object({
  productId: id,
  warehouseId: id,
  quantity: positiveInt,
  reason: z.string().trim().min(2).max(300),
});
export const adjustmentSchema = stockSchema.extend({ direction: z.enum(["IN", "OUT"]) });

export const transferCreateSchema = z.object({
  sourceWarehouseId: id,
  destinationWarehouseId: id,
  notes: optionalText,
  items: z.array(z.object({ productId: id, quantity: positiveInt })).min(1),
});