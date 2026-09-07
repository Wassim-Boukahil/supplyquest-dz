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
let userA: { email: string };
let tokenA = "";
let tokenB = "";
let productA: { id: string };

describe("Phase 4 executive experience", () => {
  beforeAll(async () => {
    const adminRole = await prisma.role.upsert({ where: { name: RoleName.ADMIN }, update: {}, create: { name: RoleName.ADMIN } });
    const passwordHash = await bcrypt.hash("TestPass123!", 4);
    organizationA = await prisma.organization.create({ data: { name: `Executive A ${suffix}`, slug: `executive-a-${suffix}` } });
    organizationB = await prisma.organization.create({ data: { name: `Executive B ${suffix}`, slug: `executive-b-${suffix}` } });
    const [userARecord, userBRecord] = await Promise.all([
      prisma.user.create({ data: { organizationId: organizationA.id, email: `executive-a-${suffix}@test.local`, passwordHash, firstName: "Executive", lastName: "A", userRoles: { create: { roleId: adminRole.id } } }, select: { email: true } }),
      prisma.user.create({ data: { organizationId: organizationB.id, email: `executive-b-${suffix}@test.local`, passwordHash, firstName: "Executive", lastName: "B", userRoles: { create: { roleId: adminRole.id } } }, select: { email: true } }),
    ]);
    userA = userARecord;
    [tokenA, tokenB] = await Promise.all([login(userARecord.email), login(userBRecord.email)]);
    const warehouse = await prisma.warehouse.create({ data: { organizationId: organizationA.id, name: "Executive warehouse", code: `EX-${suffix}` } });
    const supplier = await prisma.supplier.create({ data: { organizationId: organizationA.id, name: "Executive supplier", averageLeadTime: 6 } });
    productA = await prisma.product.create({ data: { organizationId: organizationA.id, preferredSupplierId: supplier.id, sku: `EX-${suffix}`, name: "Executive product", unit: "case", purchasePrice: 100, sellingPrice: 140, safetyStock: 10 } });
    await prisma.inventoryLevel.create({ data: { organizationId: organizationA.id, productId: productA.id, warehouseId: warehouse.id, onHandQuantity: 2 } });
    await prisma.inventoryAlert.create({ data: { organizationId: organizationA.id, fingerprint: `phase4-test:${suffix}`, type: "CRITICAL_STOCK", severity: "CRITICAL", title: "Executive test stock alert", message: "The test tenant has a critical stock signal.", recommendedAction: "Review replenishment.", productId: productA.id, warehouseId: warehouse.id } });
  });

  async function login(email: string) {
    const response = await request(app).post("/api/v1/auth/login").send({ email, password: "TestPass123!" });
    return response.body.data.token as string;
  }

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [organizationA.id, organizationB.id] } } });
    await prisma.$disconnect();
  });

  it("returns tenant-scoped dashboard and analytics aggregates", async () => {
    const dashboard = await request(app).get("/api/v1/executive/dashboard?period=30").set("Authorization", `Bearer ${tokenA}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.organization.name).toBe("Executive A " + suffix);
    expect(dashboard.body.data.kpis).toEqual(expect.objectContaining({ inventoryValue: expect.any(Number), activeProducts: 1 }));
    const analytics = await request(app).get("/api/v1/executive/analytics?period=30").set("Authorization", `Bearer ${tokenA}`);
    expect(analytics.status).toBe(200);
    expect(analytics.body.data.inventory).toBeDefined();
  });

  it("generates deduplicated quests and protects quest mutation by tenant", async () => {
    const first = await request(app).get("/api/v1/executive/quests?pageSize=100").set("Authorization", `Bearer ${tokenA}`);
    const second = await request(app).get("/api/v1/executive/quests?pageSize=100").set("Authorization", `Bearer ${tokenA}`);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.pagination.total).toBe(first.body.data.pagination.total);
    const quest = first.body.data.items[0];
    if (quest) {
      const updated = await request(app).patch(`/api/v1/executive/quests/${quest.id}`).set("Authorization", `Bearer ${tokenA}`).send({ status: "IN_PROGRESS" });
      expect(updated.status).toBe(200);
      const crossTenant = await request(app).patch(`/api/v1/executive/quests/${quest.id}`).set("Authorization", `Bearer ${tokenB}`).send({ status: "COMPLETED" });
      expect(crossTenant.status).toBe(404);
    }
  });
});