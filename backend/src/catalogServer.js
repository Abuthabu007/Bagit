import { Router } from "express";
import { productRoutes, inventoryRoutes } from "./routes/productRoutes.js";
import { requireInternalService } from "./internalServiceAuth.js";
import { startService } from "./createServiceApp.js";

const routes = Router();
routes.use("/api/products", productRoutes);
routes.use("/internal/inventory", requireInternalService, inventoryRoutes);

startService({ name: "catalog", routes });
