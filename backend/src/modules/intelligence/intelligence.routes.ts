import { Router } from "express";
import { RoleName, RecommendationStatus } from "@prisma/client";
import { z } from "zod";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validation.js";
import { sendSuccess } from "../../utils/api.js";
import * as service from "./intelligence.service.js";

const statusSchema = z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "DISMISSED"]) });
const readRoles = authorize(RoleName.ADMIN, RoleName.MANAGER, RoleName.PURCHASER, RoleName.ANALYST, RoleName.OPERATOR);
const manageRoles = authorize(RoleName.ADMIN, RoleName.MANAGER, RoleName.PURCHASER);

export const intelligenceRouter = Router();
intelligenceRouter.use(authenticate);
const org = (req: any) => req.auth.organizationId as string;
const idOf = (req: any) => String(req.params.id);

intelligenceRouter.get("/overview", readRoles, async (req, res) => sendSuccess(res, await service.getOverview(org(req), req.query as service.IntelligenceFilters)));
intelligenceRouter.get("/inventory-health", readRoles, async (req, res) => sendSuccess(res, await service.getInventoryHealth(org(req), req.query as service.IntelligenceFilters)));
intelligenceRouter.get("/demand", readRoles, async (req, res) => sendSuccess(res, await service.getDemand(org(req), req.query as service.IntelligenceFilters)));
intelligenceRouter.get("/stockout-risk", readRoles, async (req, res) => sendSuccess(res, await service.getStockoutRisk(org(req), req.query as service.IntelligenceFilters)));
intelligenceRouter.get("/overstock", readRoles, async (req, res) => sendSuccess(res, await service.getOverstock(org(req), req.query as service.IntelligenceFilters)));
intelligenceRouter.get("/slow-moving", readRoles, async (req, res) => sendSuccess(res, await service.getSlowMoving(org(req), req.query as service.IntelligenceFilters)));
intelligenceRouter.get("/abc", readRoles, async (req, res) => sendSuccess(res, await service.getAbc(org(req), req.query as service.IntelligenceFilters)));
intelligenceRouter.get("/suppliers", readRoles, async (req, res) => sendSuccess(res, await service.getSuppliers(org(req), req.query as service.IntelligenceFilters)));
intelligenceRouter.get("/warehouses", readRoles, async (req, res) => sendSuccess(res, await service.getWarehouses(org(req), req.query as service.IntelligenceFilters)));
intelligenceRouter.get("/reorder-points", readRoles, async (req, res) => sendSuccess(res, await service.getInventoryHealth(org(req), req.query as service.IntelligenceFilters)));
intelligenceRouter.get("/recommendations", readRoles, async (req, res) => sendSuccess(res, await service.getRecommendations(org(req), req.query as service.IntelligenceFilters)));
intelligenceRouter.patch("/recommendations/:id", manageRoles, validateBody(statusSchema), async (req, res) => sendSuccess(res, await service.updateRecommendation(idOf(req), org(req), req.body.status as RecommendationStatus)));
intelligenceRouter.get("/alerts", readRoles, async (req, res) => sendSuccess(res, await service.getAlerts(org(req), req.query as service.IntelligenceFilters)));
intelligenceRouter.post("/alerts/:id/resolve", manageRoles, async (req, res) => sendSuccess(res, await service.resolveAlert(idOf(req), org(req))));
intelligenceRouter.get("/products/:id", readRoles, async (req, res) => sendSuccess(res, await service.getProductIntelligence(idOf(req), org(req), req.query as service.IntelligenceFilters)));