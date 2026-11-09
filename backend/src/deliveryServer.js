import { Router } from "express";
import { deliveryRoutes } from "./routes/deliveryRoutes.js";
import { startService } from "./createServiceApp.js";

const routes = Router();
routes.use("/api/delivery", deliveryRoutes);

startService({ name: "delivery", routes, database: false });
