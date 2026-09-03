import "dotenv/config";
import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { RoleName } from "@prisma/client";
import { createApp } from "../backend/src/app.js";
import { prisma } from "../backend/src/db/prisma.js";

const app = createApp();
const suffix = Date.now().toString();
let organizationA: { id: string };
let organizationB: { id: string };
let tokenA = "";
let tokenB = "";
let categoryA: { id: string };
let categoryB: { id: string };
let productA: { id: string };
let productB: { id: string };
let supplierA: { id: string };
let customerA: { id: string };
let warehouseA: { id: string };
let warehouseA2: { id: string };
let warehouseB: { id: string };

async function login(email: string) {
  const response = await request(app).post("/api/v1/auth/login").send({ email, password: "TestPass123!" });
  expect(response.status).toBe(200);
  return response.body.data.token as string;
}

describe("Phase 1 supply-chain API", () => {
  beforeAll(async () => {
    const [adminRole, operatorRole] = await Promise.all([
      prisma.role.upsert({ where: { name: RoleName.ADMIN }, update: {}, create: { name: RoleName.ADMIN } }),
      prisma.role.upsert({ where: { name: RoleName.OPERATOR }, update: {}, create: { name: RoleName.OPERATOR } }),
    ]);
    const passwordHash = await bcrypt.hash("TestPass123!", 4);
    organizationA = await prisma.organization.create({ data: { name: `Phase 1 A ${suffix}`, slug: `phase1-a-${suffix}` } });
    organizationB = await prisma.organization.create({ data: { name: `Phase 1 B ${suffix}`, slug: `phase1-b-${suffix}` } });
    const [userA, userB] = await Promise.all([
      prisma.user.create({ data: { organizationId: organizationA.id, email: `phase1-a-${suffix}@test.local`, passwordHash, firstName: "A", lastName: "Tester", userRoles: { create: { roleId: adminRole.id } } } }),
      prisma.user.create({ data: { organizationId: organizationB.id, email: `phase1-b-${suffix}@test.local`, passwordHash, firstName: "B", lastName: "Tester", userRoles: { create: { roleId: operatorRole.id } } } }),
    ]);
    tokenA = await login(userA.email);
    tokenB = await login(userB.email);
    categoryA = await prisma.productCategory.create({ data: { organizationId: organizationA.id, name: `Category ${suffix}` }, select: { id: true } });
    categoryB = await prisma.productCategory.create({ data: { organizationId: organizationB.id, name: `Private category ${suffix}` }, select: { id: true } });
    [warehouseA, warehouseA2, warehouseB] = await Promise.all([
      prisma.warehouse.create({ data: { organizationId: organizationA.id, name: "A Main", code: `A-MAIN-${suffix}` }, select: { id: true } }),
      prisma.warehouse.create({ data: { organizationId: organizationA.id, name: "A Reserve", code: `A-RESERVE-${suffix}` }, select: { id: true } }),
      prisma.warehouse.create({ data: { organizationId: organizationB.id, name: "B Main", code: `B-MAIN-${suffix}` }, select: { id: true } }),
    ]);
    supplierA = await prisma.supplier.create({ data: { organizationId: organizationA.id, name: "Supplier A" }, select: { id: true } });
    customerA = await prisma.customer.create({ data: { organizationId: organizationA.id, name: "Customer A" }, select: { id: true } });
    productA = await prisma.product.create({ data: { organizationId: organizationA.id, categoryId: categoryA.id, sku: `A-${suffix}`, name: "Product A", unit: "carton", purchasePrice: 10, sellingPrice: 15, minimumStock: 5, safetyStock: 2 }, select: { id: true } });
    productB = await prisma.product.create({ data: { organizationId: organizationB.id, categoryId: categoryB.id, sku: `B-${suffix}`, name: "Product B", unit: "carton", purchasePrice: 10, sellingPrice: 15 }, select: { id: true } });
  });

  afterAll(async () => {
    const organizationIds = [organizationA.id, organizationB.id];
    await prisma.inventoryTransaction.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.inventoryLevel.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.purchaseOrderItem.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.purchaseOrder.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.salesOrderItem.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.salesOrder.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.inventoryTransferItem.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.inventoryTransfer.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: [organizationA.id, organizationB.id] } } });
    await prisma.$disconnect();
  });

  it("creates products and rejects cross-organization references", async () => {
    const valid = await request(app).post("/api/v1/products").set("Authorization", `Bearer ${tokenA}`).send({
      sku: `API-${suffix}`, name: "API Product", unit: "box", purchasePrice: 20, sellingPrice: 28, categoryId: categoryA.id,
    });
    expect(valid.status).toBe(201);
    const invalid = await request(app).post("/api/v1/products").set("Authorization", `Bearer ${tokenA}`).send({
      sku: `CROSS-${suffix}`, name: "Cross tenant product", unit: "box", purchasePrice: 20, sellingPrice: 28, categoryId: categoryB.id,
    });
    expect(invalid.status).toBe(404);
    expect(invalid.body.error.code).toBe("NOT_FOUND");
  });

  it("records initial stock, adjustments, and transaction history atomically", async () => {
    const initial = await request(app).post("/api/v1/inventory/initial-stock").set("Authorization", `Bearer ${tokenA}`).send({ productId: productA.id, warehouseId: warehouseA.id, quantity: 100, reason: "Opening count" });
    expect(initial.status).toBe(201);
    const adjustment = await request(app).post("/api/v1/inventory/adjustments").set("Authorization", `Bearer ${tokenA}`).send({ productId: productA.id, warehouseId: warehouseA.id, quantity: 10, direction: "OUT", reason: "Damaged cartons" });
    expect(adjustment.status).toBe(201);
    const inventory = await request(app).get(`/api/v1/inventory?productId=${productA.id}`).set("Authorization", `Bearer ${tokenA}`);
    expect(inventory.body.data.items[0]).toMatchObject({ onHandQuantity: 90, availableQuantity: 90 });
    const movements = await request(app).get(`/api/v1/inventory/transactions?productId=${productA.id}`).set("Authorization", `Bearer ${tokenA}`);
    expect(movements.body.data.items.map((item: { type: string }) => item.type)).toEqual(expect.arrayContaining(["INITIAL_STOCK", "ADJUSTMENT_OUT"]));
    const rejected = await request(app).post("/api/v1/inventory/adjustments").set("Authorization", `Bearer ${tokenA}`).send({ productId: productA.id, warehouseId: warehouseA.id, quantity: 1000, direction: "OUT", reason: "Too much" });
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe("INSUFFICIENT_STOCK");
  });

  it("receives purchase orders partially, fully, and rejects over-receiving", async () => {
    const beforeInventory = await request(app).get(`/api/v1/inventory?productId=${productA.id}&warehouseId=${warehouseA.id}`).set("Authorization", `Bearer ${tokenA}`);
    const beforeQuantity = beforeInventory.body.data.items[0].onHandQuantity;
    const created = await request(app).post("/api/v1/purchases").set("Authorization", `Bearer ${tokenA}`).send({
      supplierId: supplierA.id, warehouseId: warehouseA.id, status: "ORDERED", items: [{ productId: productA.id, quantity: 50, unitPrice: 10 }],
    });
    expect(created.status).toBe(201);
    const orderId = created.body.data.id;
    const itemId = created.body.data.items[0].id;
    const partial = await request(app).post(`/api/v1/purchases/${orderId}/receive`).set("Authorization", `Bearer ${tokenA}`).send({ items: [{ itemId, quantity: 20 }] });
    expect(partial.status).toBe(200);
    expect(partial.body.data.status).toBe("PARTIALLY_RECEIVED");
    const over = await request(app).post(`/api/v1/purchases/${orderId}/receive`).set("Authorization", `Bearer ${tokenA}`).send({ items: [{ itemId, quantity: 31 }] });
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe("RECEIPT_EXCEEDS_ORDER");
    const full = await request(app).post(`/api/v1/purchases/${orderId}/receive`).set("Authorization", `Bearer ${tokenA}`).send({ items: [{ itemId, quantity: 30 }] });
    expect(full.status).toBe(200);
    expect(full.body.data.status).toBe("RECEIVED");
    const afterInventory = await request(app).get(`/api/v1/inventory?productId=${productA.id}&warehouseId=${warehouseA.id}`).set("Authorization", `Bearer ${tokenA}`);
    expect(afterInventory.body.data.items[0].onHandQuantity).toBe(beforeQuantity + 50);
  });

  it("completes sales only when stock is available and rejects duplicates", async () => {
    const created = await request(app).post("/api/v1/sales").set("Authorization", `Bearer ${tokenA}`).send({
      customerId: customerA.id, warehouseId: warehouseA.id, status: "CONFIRMED", items: [{ productId: productA.id, quantity: 25, unitPrice: 15 }],
    });
    expect(created.status).toBe(201);
    const orderId = created.body.data.id;
    const completed = await request(app).post(`/api/v1/sales/${orderId}/complete`).set("Authorization", `Bearer ${tokenA}`);
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe("COMPLETED");
    const duplicate = await request(app).post(`/api/v1/sales/${orderId}/complete`).set("Authorization", `Bearer ${tokenA}`);
    expect(duplicate.status).toBe(409);
    const insufficient = await request(app).post("/api/v1/sales").set("Authorization", `Bearer ${tokenA}`).send({
      customerId: customerA.id, warehouseId: warehouseA.id, items: [{ productId: productA.id, quantity: 10000 }],
    });
    const insufficientComplete = await request(app).post(`/api/v1/sales/${insufficient.body.data.id}/complete`).set("Authorization", `Bearer ${tokenA}`);
    expect(insufficientComplete.status).toBe(409);
    expect(insufficientComplete.body.error.code).toBe("INSUFFICIENT_STOCK");
  });

  it("moves stock between warehouses and prevents insufficient transfers", async () => {
    const created = await request(app).post("/api/v1/inventory/transfers").set("Authorization", `Bearer ${tokenA}`).send({
      sourceWarehouseId: warehouseA.id, destinationWarehouseId: warehouseA2.id, items: [{ productId: productA.id, quantity: 15 }],
    });
    expect(created.status).toBe(201);
    const transferId = created.body.data.id;
    const completed = await request(app).post(`/api/v1/inventory/transfers/${transferId}/complete`).set("Authorization", `Bearer ${tokenA}`);
    expect(completed.status).toBe(200);
    const source = await request(app).get(`/api/v1/inventory?productId=${productA.id}&warehouseId=${warehouseA.id}`).set("Authorization", `Bearer ${tokenA}`);
    const destination = await request(app).get(`/api/v1/inventory?productId=${productA.id}&warehouseId=${warehouseA2.id}`).set("Authorization", `Bearer ${tokenA}`);
    expect(source.body.data.items[0].onHandQuantity).toBeGreaterThanOrEqual(0);
    expect(destination.body.data.items[0].onHandQuantity).toBe(15);
    const tooMuch = await request(app).post("/api/v1/inventory/transfers").set("Authorization", `Bearer ${tokenA}`).send({
      sourceWarehouseId: warehouseA.id, destinationWarehouseId: warehouseA2.id, items: [{ productId: productA.id, quantity: 10000 }],
    });
    const rejected = await request(app).post(`/api/v1/inventory/transfers/${tooMuch.body.data.id}/complete`).set("Authorization", `Bearer ${tokenA}`);
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe("INSUFFICIENT_STOCK");
  });

  it("isolates every organization-owned resource server-side", async () => {
    for (const path of [`/api/v1/products/${productB.id}`, `/api/v1/warehouses/${warehouseB.id}`]) {
      const response = await request(app).get(path).set("Authorization", `Bearer ${tokenA}`);
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    }
    const list = await request(app).get("/api/v1/products").set("Authorization", `Bearer ${tokenA}`);
    expect(list.body.data.items.every((item: { id: string }) => item.id !== productB.id)).toBe(true);
    const otherTenantList = await request(app).get("/api/v1/products").set("Authorization", `Bearer ${tokenB}`);
    expect(otherTenantList.body.data.items.map((item: { id: string }) => item.id)).toContain(productB.id);
  });
});