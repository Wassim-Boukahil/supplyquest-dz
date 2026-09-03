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
let userA: { id: string; email: string };
let userB: { id: string; email: string };
let warehouseB: { id: string };

describe("Phase 0 API foundation", () => {
  beforeAll(async () => {
    const [adminRole, operatorRole] = await Promise.all([
      prisma.role.upsert({ where: { name: RoleName.ADMIN }, update: {}, create: { name: RoleName.ADMIN } }),
      prisma.role.upsert({ where: { name: RoleName.OPERATOR }, update: {}, create: { name: RoleName.OPERATOR } }),
    ]);
    const passwordHash = await bcrypt.hash("TestPass123!", 4);
    organizationA = await prisma.organization.create({ data: { name: `Test A ${suffix}`, slug: `test-a-${suffix}` } });
    organizationB = await prisma.organization.create({ data: { name: `Test B ${suffix}`, slug: `test-b-${suffix}` } });
    userA = await prisma.user.create({ data: { organizationId: organizationA.id, email: `a-${suffix}@test.local`, passwordHash, firstName: "A", lastName: "Tester", userRoles: { create: { roleId: adminRole.id } } }, select: { id: true, email: true } });
    userB = await prisma.user.create({ data: { organizationId: organizationB.id, email: `b-${suffix}@test.local`, passwordHash, firstName: "B", lastName: "Tester", userRoles: { create: { roleId: operatorRole.id } } }, select: { id: true, email: true } });
    warehouseB = await prisma.warehouse.create({ data: { organizationId: organizationB.id, name: "Private B Warehouse", code: `B-${suffix}` }, select: { id: true } });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [organizationA.id, organizationB.id] } } });
    await prisma.$disconnect();
  });

  it("returns a healthy service response", async () => {
    const response = await request(app).get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: { status: "ok" } });
  });

  it("registers an organization and its initial admin", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({ organizationName: `Registered ${suffix}`, organizationSlug: `registered-${suffix}`, firstName: "New", lastName: "Admin", email: `new-${suffix}@test.local`, password: "TestPass123!" });
    expect(response.status).toBe(201);
    expect(response.body.data.user.roles).toContain("ADMIN");
    await prisma.organization.deleteMany({ where: { slug: `registered-${suffix}` } });
  });

  it("logs in with valid credentials", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({ email: userA.email, password: "TestPass123!" });
    expect(response.status).toBe(200);
    expect(response.body.data.token).toEqual(expect.any(String));
  });

  it("rejects invalid credentials", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({ email: userA.email, password: "wrong-password" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects protected requests without authentication", async () => {
    const response = await request(app).get("/api/v1/foundation/summary");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("allows protected requests with authentication", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email: userA.email, password: "TestPass123!" });
    const response = await request(app).get("/api/v1/foundation/summary").set("Authorization", `Bearer ${login.body.data.token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.organization.id).toBe(organizationA.id);
  });

  it("enforces role authorization", async () => {
    const loginA = await request(app).post("/api/v1/auth/login").send({ email: userA.email, password: "TestPass123!" });
    expect((await request(app).get("/api/v1/foundation/admin-check").set("Authorization", `Bearer ${loginA.body.data.token}`)).status).toBe(200);
    const loginB = await request(app).post("/api/v1/auth/login").send({ email: userB.email, password: "TestPass123!" });
    expect((await request(app).get("/api/v1/foundation/admin-check").set("Authorization", `Bearer ${loginB.body.data.token}`)).status).toBe(403);
  });

  it("rejects cross-organization data access server-side", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email: userA.email, password: "TestPass123!" });
    const response = await request(app).get(`/api/v1/foundation/warehouses/${warehouseB.id}`).set("Authorization", `Bearer ${login.body.data.token}`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});