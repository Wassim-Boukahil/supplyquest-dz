import { Router } from "express";
import { RoleName } from "@prisma/client";
import { z } from "zod";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validation.js";
import { sendSuccess } from "../../utils/api.js";
import * as service from "./forecasting.service.js";

const readRoles = authorize(RoleName.ADMIN, RoleName.MANAGER, RoleName.PURCHASER, RoleName.ANALYST, RoleName.OPERATOR);
const manageRoles = authorize(RoleName.ADMIN, RoleName.MANAGER, RoleName.PURCHASER, RoleName.ANALYST);
const generateSchema = z.object({ warehouseId: z.string().uuid().optional(), horizonDays: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(14) });

export const forecastingRouter = Router();
forecastingRouter.use(authenticate);
const org = (req: any) => req.auth.organizationId as string;
const actor = (req: any) => req.auth.userId as string;
const idOf = (req: any) => String(req.params.id);

forecastingRouter.get("/overview", readRoles, async (req, res) => sendSuccess(res, await service.getForecastOverview(org(req))));
forecastingRouter.get("/products/:id", readRoles, async (req, res) => sendSuccess(res, await service.getProductForecast(org(req), idOf(req), req.query as service.ForecastFilters)));
forecastingRouter.get("/products/:id/forecast", readRoles, async (req, res) => sendSuccess(res, await service.getProductForecast(org(req), idOf(req), req.query as service.ForecastFilters)));
forecastingRouter.post("/products/:id/generate", manageRoles, validateBody(generateSchema), async (req, res) => sendSuccess(res, await service.generateForecast(org(req), idOf(req), actor(req), req.body)));
forecastingRouter.get("/runs", readRoles, async (req, res) => sendSuccess(res, await service.getForecastRuns(org(req), req.query as service.ForecastFilters)));
forecastingRouter.get("/performance", readRoles, async (req, res) => sendSuccess(res, await service.getForecastPerformance(org(req))));