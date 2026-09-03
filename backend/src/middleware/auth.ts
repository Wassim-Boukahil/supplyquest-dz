import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { RoleName } from "@prisma/client";
import { config } from "../config.js";
import { prisma } from "../db/prisma.js";
import { AppError } from "./errors.js";

type TokenPayload = {
  sub: string;
  organizationId: string;
};

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

    if (!token) {
      throw new AppError("AUTH_REQUIRED", "Authentication is required.", 401);
    }

    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        organizationId: true,
        isActive: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
    });

    if (!user || !user.isActive || user.organizationId !== payload.organizationId) {
      throw new AppError("AUTH_INVALID", "The authentication token is invalid.", 401);
    }

    req.auth = {
      userId: user.id,
      organizationId: user.organizationId,
      roles: user.userRoles.map(({ role }) => role.name),
    };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      next(new AppError("AUTH_INVALID", "The authentication token is invalid or expired.", 401));
      return;
    }
    next(error);
  }
};

export function authorize(...allowedRoles: RoleName[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new AppError("AUTH_REQUIRED", "Authentication is required.", 401));
      return;
    }

    if (!allowedRoles.some((role) => req.auth?.roles.includes(role))) {
      next(new AppError("FORBIDDEN", "You do not have permission to perform this action.", 403));
      return;
    }

    next();
  };
}