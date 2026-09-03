import { Router } from "express";
import { RoleName } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth.js";
import { prisma } from "../../db/prisma.js";
import { sendSuccess } from "../../utils/api.js";

export const foundationRouter = Router();

foundationRouter.get("/summary", authenticate, async (req, res) => {
  const organizationId = req.auth!.organizationId;
  const [organization, users, warehouses, categories, products, suppliers, customers] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, slug: true } }),
    prisma.user.count({ where: { organizationId } }),
    prisma.warehouse.count({ where: { organizationId } }),
    prisma.productCategory.count({ where: { organizationId } }),
    prisma.product.count({ where: { organizationId } }),
    prisma.supplier.count({ where: { organizationId } }),
    prisma.customer.count({ where: { organizationId } }),
  ]);
  return sendSuccess(res, { organization, counts: { users, warehouses, categories, products, suppliers, customers } });
});

foundationRouter.get("/admin-check", authenticate, authorize(RoleName.ADMIN), (_req, res) => {
  return sendSuccess(res, { allowed: true, message: "Admin authorization is active." });
});

foundationRouter.get("/warehouses/:id", authenticate, async (req, res) => {
  const warehouseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, organizationId: req.auth!.organizationId },
    select: { id: true, name: true, code: true, location: true, wilaya: true, capacity: true, isActive: true },
  });
  if (!warehouse) {
    res.status(404);
    return res.json({ success: false, error: { code: "NOT_FOUND", message: "Warehouse not found." } });
  }
  return sendSuccess(res, warehouse);
});