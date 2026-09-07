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
let warehouseA: { id: string };

async function login(email: string) {
  const response = await request(app).post("/api/v1/auth/login").send({ email, password: "TestPass123!" });
  return response.body.data.token as string;
}

describe("Phase 3 demand forecasting", () => {
  beforeAll(async () => {
    const adminRole = await prisma.role.upsert({ where: { name: RoleName.ADMIN }, update: {}, create: { name: RoleName.ADMIN } });
    const passwordHash = await bcrypt.hash("TestPass123!", 4);
    [organizationA, organizationB] = await Promise.all([
      prisma.organization.create({ data: { name: `Forecast A ${suffix}`, slug: `forecast-a-${suffix}` } }),
      prisma.organization.create({ data: { name: `Forecast B ${suffix}`, slug: `forecast-b-${suffix}` } }),
    ]);
    const [userA, userB] = await Promise.all([
      prisma.user.create({ data: { organizationId: organizationA.id, email: `forecast-a-${suffix}@test.local`, passwordHash, firstName: "Forecast", lastName: "A", userRoles: { create: { roleId: adminRole.id } } } }),
      prisma.user.create({ data: { organizationId: organizationB.id, email: `forecast-b-${suffix}@test.local`, passwordHash, firstName: "Forecast", lastName: "B", userRoles: { create: { roleId: adminRole.id } } } }),
    ]);
    [tokenA, tokenB] = await Promise.all([login(userA.email), login(userB.email)]);
    const supplier = await prisma.supplier.create({ data: { organizationId: organizationA.id, name: "Forecast supplier", averageLeadTime: 7 } });
    warehouseA = await prisma.warehouse.create({ data: { organizationId: organizationA.id, name: "Forecast warehouse", code: `FC-${suffix}` }, select: { id: true } });
    productA = await prisma.product.create({ data: { organizationId: organizationA.id, preferredSupplierId: supplier.id, sku: `FC-A-${suffix}`, name: "Forecast product", unit: "box", purchasePrice: 10, sellingPrice: 15, safetyStock: 4 }, select: { id: true } });
    productB = await prisma.product.create({ data: { organizationId: organizationB.id, sku: `FC-B-${suffix}`, name: "Private forecast product", unit: "box", purchasePrice: 10, sellingPrice: 15 }, select: { id: true } });
    await prisma.inventoryLevel.create({ data: { organizationId: organizationA.id, productId: productA.id, warehouseId: warehouseA.id, onHandQuantity: 2 } });
    const transactions = Array.from({ length: 84 }, (_, index) => ({
      organizationId: organizationA.id, productId: productA.id, warehouseId: warehouseA.id, quantity: 4 + (index % 3),
      type: "SALE" as const, referenceType: "SALES_ORDER", actorId: userA.id, createdAt: new Date(Date.now() - (index + 1) * 86_400_000),
    }));
    await prisma.inventoryTransaction.createMany({ data: transactions });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [organizationA.id, organizationB.id] } } });
    await prisma.$disconnect();
  });

  it("generates and persists a tenant-scoped forecast with backtesting", async () => {
    const generated = await request(app).post(`/api/v1/forecasting/products/${productA.id}/generate`).set("Authorization", `Bearer ${tokenA}`).send({ warehouseId: warehouseA.id, horizonDays: 14 });
    expect(generated.status).toBe(200);
    expect(generated.body.data.run).toMatchObject({ productId: productA.id, warehouseId: warehouseA.id, horizonDays: 14 });
    expect(generated.body.data.run.points.filter((point: { pointType: string }) => point.pointType === "FORECAST")).toHaveLength(14);
    expect(generated.body.data.run.points.some((point: { pointType: string }) => point.pointType === "BACKTEST")).toBe(true);
    expect(generated.body.data.run.selectedMethod).toMatch(/NAIVE|MOVING|EXPONENTIAL/);
    expect(generated.body.data.recommendation).toMatchObject({ recommendationMode: "FORECAST_AWARE", forecastRunId: generated.body.data.run.id });

    const detail = await request(app).get(`/api/v1/forecasting/products/${productA.id}?warehouseId=${warehouseA.id}`).set("Authorization", `Bearer ${tokenA}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.run.id).toBe(generated.body.data.run.id);
    expect(detail.body.data.historical.length).toBeGreaterThan(0);

    const runs = await request(app).get("/api/v1/forecasting/runs").set("Authorization", `Bearer ${tokenA}`);
    expect(runs.status).toBe(200);
    expect(runs.body.data.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it("protects forecast detail and generation across organizations", async () => {
    const detail = await request(app).get(`/api/v1/forecasting/products/${productB.id}`).set("Authorization", `Bearer ${tokenA}`);
    expect(detail.status).toBe(404);
    const generated = await request(app).post(`/api/v1/forecasting/products/${productA.id}/generate`).set("Authorization", `Bearer ${tokenB}`).send({ horizonDays: 7 });
    expect(generated.status).toBe(404);
  });

  it("returns a structured unavailable-service error", async () => {
    const previous = process.env.PYTHON_BIN;
    process.env.PYTHON_BIN = "forecasting-binary-does-not-exist";
    const response = await request(app).post(`/api/v1/forecasting/products/${productA.id}/generate`).set("Authorization", `Bearer ${tokenA}`).send({ horizonDays: 7 });
    if (previous === undefined) delete process.env.PYTHON_BIN;
    else process.env.PYTHON_BIN = previous;
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("ANALYTICS_UNAVAILABLE");
  });
});