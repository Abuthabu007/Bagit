import { Router } from "express";
import { authRoutes } from "./routes/authRoutes.js";
import { internalIdentityRoutes } from "./routes/internalIdentityRoutes.js";
import { startService } from "./createServiceApp.js";

const routes = Router();
routes.use("/api/auth", authRoutes);
routes.use("/internal/session", internalIdentityRoutes);

startService({ name: "identity", routes });
