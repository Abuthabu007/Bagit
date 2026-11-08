import { Router } from "express";
import { checkMockServiceability } from "../services/authService.js";

export const deliveryRoutes = Router();

deliveryRoutes.get("/serviceability/:pincode", (request, response) => {
  const result = checkMockServiceability(request.params.pincode);
  const { status, ...body } = result;
  return response.status(status).json(body);
});
