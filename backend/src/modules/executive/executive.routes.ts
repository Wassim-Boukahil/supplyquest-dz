import { Router } from "express";
import { RecommendationStatus, RoleName } from "@prisma/client";
import { z } from "zod";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validation.js";
import { sendSuccess } from "../../utils/api.js";
import * as service from "./executive.service.js";

const readRoles = authorize(RoleName.ADMIN, RoleName.MANAGER, RoleName.PURCHASER, RoleName.ANALYST, RoleName.OPERATOR);
const manageRoles = authorize(RoleName.ADMIN, RoleName.MANAGER, RoleName.PURCHASER, RoleName.ANALYST);
const statusSchema = z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "DISMISSED"]) });

export const executiveRouter = Router();
executiveRouter.use(authenticate);
const org = (req: any) => req.auth.organizationId as string;
const idOf = (req: any) => String(req.params.id);

executiveRouter.get("/dashboard", readRoles, async (req, res) => sendSuccess(res, await service.getExecutiveDashboard(org(req), req.query as service.ExecutiveFilters)));
executiveRouter.get("/analytics", readRoles, async (req, res) => sendSuccess(res, await service.getAnalytics(org(req), req.query as service.ExecutiveFilters)));
executiveRouter.get("/quests", readRoles, async (req, res) => sendSuccess(res, await service.listQuests(org(req), req.query as service.ExecutiveFilters)));
executiveRouter.patch("/quests/:id", manageRoles, validateBody(statusSchema), async (req, res) => sendSuccess(res, await service.updateQuest(idOf(req), org(req), req.body.status as RecommendationStatus)));