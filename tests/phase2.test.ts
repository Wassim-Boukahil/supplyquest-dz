import "dotenv/config";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
let productA: { id: string };
let productB: { id: string };
let productDead: { id: string };
let warehouseA: { id: string };
let warehouseB: { id: string };

async function login(email: string) {
  const response = await request(app).post("/api/v1/auth/login").send({ email, password: "TestPass123!" });
  return response.body.data.token as string;
}

describe("Phase 2 inventory intelligence", () => {
  beforeAll(async () => {
    const [adminRole, operatorRole] = await Promise.all([
      prisma.role.upsert({ where: { name: RoleName.ADMIN }, update: {}, create: { name: RoleName.ADMIN } }),
      prisma.role.upsert({ where: { name: RoleName.OPERATOR }, update: {}, create: { name: RoleName.OPERATOR } }),
    ]);
    const passwordHash = await bcrypt.hash("TestPass123!", 4);
    [organizationA, organizationB] = await Promise.all([
      prisma.organization.create({ data: { name: `Intelligence A ${suffix}`, slug: `intelligence-a-${suffix}` } }),
      prisma.organization.create({ data: { name: `Intelligence B ${suffix}`, slug: `intelligence-b-${suffix}` } }),
    ]);
    const [userA, userB] = await Promise.all([
      prisma.user.create({ data: { organizationId: organizationA.id, email: `intelligence-a-${suffix}@test.local`, passwordHash, firstName: "A", lastName: "Tester", userRoles: { create: { roleId: adminRole.id } } } }),
      prisma.user.create({ data: { organizationId: organizationB.id, email: `intelligence-b-${suffix}@test.local`, passwordHash, firstName: "B", lastName: "Tester", userRoles: { create: { roleId: operatorRole.id } } } }),
    ]);
    [tokenA, tokenB] = await Promise.all([login(userA.email), login(userB.email)]);
    const [supplierA, customerA] = await Promise.all([
      prisma.supplier.create({ data: { organizationId: organizationA.id, name: "Reliable supplier", averageLeadTime: 14 } }),
      prisma.customer.create({ data: { organizationId: organizationA.id, name: "Customer" } }),
    ]);
    warehouseA = await prisma.warehouse.create({ data: { organizationId: organizationA.id, name: "A Main", code: `INT-A-${suffix}` }, select: { id: true } });
    warehouseB = await prisma.warehouse.create({ data: { organizationId: organizationB.id, name: "B Main", code: `INT-B-${suffix}` }, select: { id: true } });
    productA = await prisma.product.create({ data: { organizationId: organizationA.id, preferredSupplierId: supplierA.id, sku: `INT-A-${suffix}`, name: "Fast critical product", unit: "box", purchasePrice: 100, sellingPrice: 150, safetyStock: 2 }, select: { id: true } });
    productB = await prisma.product.create({ data: { organizationId: organizationB.id, sku: `INT-B-${suffix}`, name: "Private product", unit: "box", purchasePrice: 100, sellingPrice: 150 }, select: { id: true } });
    productDead = await prisma.product.create({ data: { organizationId: organizationA.id, sku: `INT-DEAD-${suffix}`, name: "Dead stock product", unit: "box", purchasePrice: 80, sellingPrice: 120 }, select: { id: true } });
    const old = new Date(Date.now() - 40 * 86_400_000);
    const recent = new Date(Date.now() - 2 * 86_400_000);
    await prisma.inventoryLevel.create({ data: { organizationId: organizationA.id, productId: productA.id, warehouseId: warehouseA.id, onHandQuantity: 10 } });
    await prisma.inventoryTransaction.createMany({ data: [
      { organizationId: organizationA.id, productId: productA.id, warehouseId: warehouseA.id, quantity: 100, type: "INITIAL_STOCK", actorId: userA.id, createdAt: old },
      { organizationId: organizationA.id, productId: productA.id, warehouseId: warehouseA.id, quantity: 50, type: "SALE", referenceType: "SALES_ORDER", actorId: userA.id, createdAt: old },
      { organizationId: organizationA.id, productId: productA.id, warehouseId: warehouseA.id, quantity: 40, type: "SALE", referenceType: "SALES_ORDER", actorId: userA.id, createdAt: recent },
    ] });
    await prisma.inventoryLevel.create({ data: { organizationId: organizationA.id, productId: productDead.id, warehouseId: warehouseA.id, onHandQuantity: 50 } });
    await prisma.inventoryTransaction.create({ data: { organizationId: organizationA.id, productId: productDead.id, warehouseId: warehouseA.id, quantity: 50, type: "INITIAL_STOCK", actorId: userA.id, createdAt: old } });
    // Keep these references in setup to make the fixture's business ownership explicit.
    expect(customerA.organizationId).toBe(organizationA.id);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [organizationA.id, organizationB.id] } } });
    await prisma.$disconnect();
  });

  it("calculates explainable health, risk, and reorder quantities from transactions", async () => {
    const health = await request(app).get(`/api/v1/intelligence/inventory-health?productId=${productA.id}&period=90`).set("Authorization", `Bearer ${tokenA}`);
    expect(health.status).toBe(200);
    expect(health.body.data.items[0]).toMatchObject({ productId: productA.id, availableQuantity: 10, riskLevel: expect.stringMatching(/HIGH|CRITICAL/), reorderPoint: 16 });
    expect(health.body.data.items[0].reason).toContain("days");

    const recommendations = await request(app).get(`/api/v1/intelligence/recommendations?productId=${productA.id}`).set("Authorization", `Bearer ${tokenA}`);
    expect(recommendations.status).toBe(200);
    expect(recommendations.body.data.items[0]).toMatchObject({ productId: productA.id, recommendedQuantity: 20 });
    expect(recommendations.body.data.items[0].reason).toContain("Recommended order");
  });

  it("generates deduplicated alerts and protects intelligence across tenants", async () => {
    const first = await request(app).get("/api/v1/intelligence/alerts").set("Authorization", `Bearer ${tokenA}`);
    const second = await request(app).get("/api/v1/intelligence/alerts").set("Authorization", `Bearer ${tokenA}`);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.pagination.total).toBe(first.body.data.pagination.total);
    expect(second.body.data.items.some((item: { productId?: string }) => item.productId === productA.id)).toBe(true);

    const crossTenantProduct = await request(app).get(`/api/v1/intelligence/products/${productB.id}`).set("Authorization", `Bearer ${tokenA}`);
    expect(crossTenantProduct.status).toBe(404);
    const otherTenantHealth = await request(app).get("/api/v1/intelligence/inventory-health").set("Authorization", `Bearer ${tokenA}`);
    expect(otherTenantHealth.body.data.items.every((item: { productId: string }) => item.productId !== productB.id)).toBe(true);
  });

  it("reports older zero-demand stock as dead movement while preserving short-history uncertainty", async () => {
    const slow = await request(app).get(`/api/v1/intelligence/slow-moving?productId=${productDead.id}`).set("Authorization", `Bearer ${tokenA}`);
    expect(slow.status).toBe(200);
    expect(slow.body.data.items[0]).toMatchObject({ productId: productDead.id, slowMoving: "DEAD" });

    const invalidPeriod = await request(app).get("/api/v1/intelligence/inventory-health?period=0").set("Authorization", `Bearer ${tokenA}`);
    expect(invalidPeriod.status).toBe(200);
    expect(invalidPeriod.body.data.items.length).toBeGreaterThan(0);
  });
});