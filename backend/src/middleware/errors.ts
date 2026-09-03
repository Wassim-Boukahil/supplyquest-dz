import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { sendError } from "../utils/api.js";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  sendError(res, "NOT_FOUND", "The requested resource was not found.", 404);
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    sendError(res, "VALIDATION_ERROR", error.issues[0]?.message ?? "Invalid input.", 422);
    return;
  }

  if (error instanceof AppError) {
    sendError(res, error.code, error.message, error.status);
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    sendError(res, "CONFLICT", "A record with these details already exists.", 409);
    return;
  }

  console.error(error);
  sendError(res, "INTERNAL_ERROR", "An unexpected error occurred.", 500);
};