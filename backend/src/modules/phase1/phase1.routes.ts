import { Router } from "express";
import { RoleName } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validation.js";
import { sendSuccess } from "../../utils/api.js";
import * as service from "./phase1.service.js";
import {
  categoryCreateSchema, categoryUpdateSchema, customerCreateSchema, customerUpdateSchema,
  productCreateSchema, productUpdateSchema, purchaseCreateSchema, receiveSchema, salesCreateSchema,
  stockSchema, adjustmentSchema, supplierCreateSchema, supplierUpdateSchema, transferCreateSchema, warehouseCreateSchema,
  warehouseUpdateSchema,
} from "./phase1.schemas.js";

export const phase1Router = Router();
phase1Router.use(authenticate);
const org = (req: any) => req.auth.organizationId as string;
const actor = (req: any) => req.auth.userId as string;
const idOf = (req: any) => String(req.params.id);
const readRoles = authorize(...service.readableRoles);
const manageRoles = authorize(RoleName.ADMIN, RoleName.MANAGER, RoleName.PURCHASER, RoleName.OPERATOR);
const inventoryRoles = authorize(RoleName.ADMIN, RoleName.MANAGER, RoleName.OPERATOR, RoleName.PURCHASER);

function collection(entity: "products" | "categories" | "suppliers" | "customers" | "warehouses", path: string) {
  phase1Router.get(path, readRoles, async (req, res) => sendSuccess(res, await service.listEntity(entity, org(req), req.query as any)));
  phase1Router.get(`${path}/:id`, readRoles, async (req, res) => sendSuccess(res, await service.getEntity(entity, idOf(req), org(req))));
}

collection("products", "/products");
collection("categories", "/categories");
collection("suppliers", "/suppliers");
collection("customers", "/customers");
collection("warehouses", "/warehouses");

phase1Router.post("/products", manageRoles, validateBody(productCreateSchema), async (req, res) => sendSuccess(res, await service.createEntity("products", org(req), req.body), 201));
phase1Router.patch("/products/:id", manageRoles, validateBody(productUpdateSchema), async (req, res) => sendSuccess(res, await service.updateEntity("products", idOf(req), org(req), req.body)));
phase1Router.post("/products/:id/archive", manageRoles, async (req, res) => sendSuccess(res, await service.setEntityActive("products", idOf(req), org(req), false)));
phase1Router.post("/products/:id/activate", manageRoles, async (req, res) => sendSuccess(res, await service.setEntityActive("products", idOf(req), org(req), true)));

phase1Router.post("/categories", manageRoles, validateBody(categoryCreateSchema), async (req, res) => sendSuccess(res, await service.createEntity("categories", org(req), req.body), 201));
phase1Router.patch("/categories/:id", manageRoles, validateBody(categoryUpdateSchema), async (req, res) => sendSuccess(res, await service.updateEntity("categories", idOf(req), org(req), req.body)));
phase1Router.delete("/categories/:id", manageRoles, async (req, res) => sendSuccess(res, await service.deleteCategory(idOf(req), org(req))));

for (const entity of ["suppliers", "customers", "warehouses"] as const) {
  const schema = entity === "suppliers" ? supplierCreateSchema : entity === "customers" ? customerCreateSchema : warehouseCreateSchema;
  const updateSchema = entity === "suppliers" ? supplierUpdateSchema : entity === "customers" ? customerUpdateSchema : warehouseUpdateSchema;
  phase1Router.post(`/${entity}`, manageRoles, validateBody(schema), async (req, res) => sendSuccess(res, await service.createEntity(entity, org(req), req.body), 201));
  phase1Router.patch(`/${entity}/:id`, manageRoles, validateBody(updateSchema), async (req, res) => sendSuccess(res, await service.updateEntity(entity, idOf(req), org(req), req.body)));
  phase1Router.post(`/${entity}/:id/archive`, manageRoles, async (req, res) => sendSuccess(res, await service.setEntityActive(entity, idOf(req), org(req), false)));
  phase1Router.post(`/${entity}/:id/activate`, manageRoles, async (req, res) => sendSuccess(res, await service.setEntityActive(entity, idOf(req), org(req), true)));
}

phase1Router.get("/inventory/transactions", readRoles, async (req, res) => sendSuccess(res, await service.listTransactions(org(req), req.query as any)));
phase1Router.get("/inventory", readRoles, async (req, res) => sendSuccess(res, await service.listInventory(org(req), req.query as any)));
phase1Router.post("/inventory/initial-stock", inventoryRoles, validateBody(stockSchema), async (req, res) => sendSuccess(res, await service.initialStock(org(req), actor(req), req.body), 201));
phase1Router.post("/inventory/adjustments", inventoryRoles, validateBody(adjustmentSchema), async (req, res) => sendSuccess(res, await service.adjustStock(org(req), actor(req), req.body), 201));

phase1Router.get("/purchases", readRoles, async (req, res) => sendSuccess(res, await service.listOrders("purchase", org(req), req.query as any)));
phase1Router.get("/purchases/:id", readRoles, async (req, res) => sendSuccess(res, await service.getOrder("purchase", idOf(req), org(req))));
phase1Router.post("/purchases", manageRoles, validateBody(purchaseCreateSchema), async (req, res) => sendSuccess(res, await service.createPurchase(org(req), req.body), 201));
phase1Router.post("/purchases/:id/receive", authorize(RoleName.ADMIN, RoleName.MANAGER, RoleName.PURCHASER, RoleName.OPERATOR), validateBody(receiveSchema), async (req, res) => sendSuccess(res, await service.receivePurchase(idOf(req), org(req), actor(req), req.body)));

phase1Router.get("/sales", readRoles, async (req, res) => sendSuccess(res, await service.listOrders("sales", org(req), req.query as any)));
phase1Router.get("/sales/:id", readRoles, async (req, res) => sendSuccess(res, await service.getOrder("sales", idOf(req), org(req))));
phase1Router.post("/sales", manageRoles, validateBody(salesCreateSchema), async (req, res) => sendSuccess(res, await service.createSales(org(req), req.body), 201));
phase1Router.post("/sales/:id/complete", authorize(RoleName.ADMIN, RoleName.MANAGER, RoleName.OPERATOR), async (req, res) => sendSuccess(res, await service.completeSales(idOf(req), org(req), actor(req))));

phase1Router.get("/inventory/transfers", readRoles, async (req, res) => sendSuccess(res, await service.listTransfers(org(req), req.query as any)));
phase1Router.get("/inventory/transfers/:id", readRoles, async (req, res) => sendSuccess(res, await service.getTransfer(idOf(req), org(req))));
phase1Router.post("/inventory/transfers", inventoryRoles, validateBody(transferCreateSchema), async (req, res) => sendSuccess(res, await service.createTransfer(org(req), actor(req), req.body), 201));
phase1Router.post("/inventory/transfers/:id/complete", inventoryRoles, async (req, res) => sendSuccess(res, await service.completeTransfer(idOf(req), org(req), actor(req))));
phase1Router.post("/inventory/transfers/:id/cancel", inventoryRoles, async (req, res) => sendSuccess(res, await service.cancelTransfer(idOf(req), org(req))));
phase1Router.get("/inventory/:id", readRoles, async (req, res) => {
  const item = await service.listInventory(org(req), { productId: idOf(req), pageSize: "100" });
  return sendSuccess(res, item);
});