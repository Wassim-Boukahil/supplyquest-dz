import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { authRouter } from "./modules/auth/auth.routes.js";
import { foundationRouter } from "./modules/foundation/foundation.routes.js";
import { phase1Router } from "./modules/phase1/phase1.routes.js";
import { intelligenceRouter } from "./modules/intelligence/intelligence.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { sendSuccess } from "./utils/api.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.get("/api/v1/health", (_req, res) => {
    return sendSuccess(res, { status: "ok", service: "supplyquest-api", timestamp: new Date().toISOString() });
  });
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/foundation", foundationRouter);
  app.use("/api/v1", phase1Router);
  app.use("/api/v1/intelligence", intelligenceRouter);

  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      notFoundHandler(req, res, next);
      return;
    }
    next();
  });
  app.use(errorHandler);
  return app;
}