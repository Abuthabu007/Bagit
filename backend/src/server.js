import express from "express";
import { productRoutes } from "./routes/productRoutes.js";
import { orderRoutes } from "./routes/orderRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { deliveryRoutes } from "./routes/deliveryRoutes.js";
import { pool } from "./db/pool.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);
app.set("etag", false);
app.use(express.json());
app.use("/api", (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/delivery", deliveryRoutes);


app.get("/healthz", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.get("/readyz", async (_request, response) => {
  try {
    await pool.query("SELECT 1");
    response.status(200).json({ status: "ready" });
  } catch (error) {
    console.error("Database readiness check failed:", error);
    response.status(503).json({ status: "not_ready" });
  }
});

app.use((error, _request, response, _next) => {
  console.error("Unhandled request error:", error);
  response.status(500).json({ error: "Internal server error" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`API listening on port ${port}`);
});