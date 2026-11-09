import { Router } from "express";
import { orderRoutes } from "./routes/orderRoutes.js";
import { startService } from "./createServiceApp.js";

const routes = Router();
routes.use("/api/orders", orderRoutes);

startService({ name: "orders", routes });
