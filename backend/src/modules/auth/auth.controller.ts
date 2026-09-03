import type { Request, Response } from "express";
import { getCurrentUser, login, register } from "./auth.service.js";
import { sendSuccess } from "../../utils/api.js";

export async function registerController(req: Request, res: Response) {
  return sendSuccess(res, await register(req.body), 201);
}

export async function loginController(req: Request, res: Response) {
  return sendSuccess(res, await login(req.body));
}

export async function logoutController(_req: Request, res: Response) {
  return sendSuccess(res, { loggedOut: true });
}

export async function meController(req: Request, res: Response) {
  return sendSuccess(res, await getCurrentUser(req.auth!.userId));
}