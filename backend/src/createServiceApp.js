import express from "express";
import { pool } from "./db/pool.js";

export function startService({ name, routes, database = true }) {
  const app = express();
  const port = Number(process.env.PORT ?? 3000);

  app.set("etag", false);
  app.use(express.json());
  app.use("/api", (_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(routes);

  app.get("/healthz", (_request, response) => {
    response.status(200).json({ status: "ok", service: name });
  });

  app.get("/readyz", async (_request, response) => {
    if (!database) {
      return response.status(200).json({ status: "ready", service: name });
    }

    try {
      await pool.query("SELECT 1");
      return response.status(200).json({ status: "ready", service: name });
    } catch (error) {
      console.error(`${name} database readiness check failed:`, error);
      return response.status(503).json({ status: "not_ready", service: name });
    }
  });

  app.use((error, _request, response, _next) => {
    console.error(`${name} request failed:`, error);
    response.status(500).json({ error: "Internal server error" });
  });

  return app.listen(port, "0.0.0.0", () => {
    console.log(`${name} service listening on port ${port}`);
  });
}
