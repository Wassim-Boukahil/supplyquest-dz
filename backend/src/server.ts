import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import express from "express";
import { createServer as createViteServer } from "vite";
import { config } from "./config.js";
import { createApp } from "./app.js";

async function start() {
  const app = createApp();
  const server = http.createServer(app);
  const frontendRoot = path.resolve(process.cwd(), "frontend");

  if (config.NODE_ENV === "production") {
    const distRoot = path.resolve(frontendRoot, "dist");
    app.use(express.static(distRoot));
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) {
        next();
        return;
      }
      res.sendFile(path.join(distRoot, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      root: frontendRoot,
      server: { middlewareMode: true, allowedHosts: true, hmr: { server } },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        next();
        return;
      }
      try {
        let template = fs.readFileSync(path.join(frontendRoot, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
  }

  server.listen(config.PORT, "0.0.0.0", () => {
    console.log(`SupplyQuest DZ listening on port ${config.PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});