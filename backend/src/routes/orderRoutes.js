import { Router } from "express";
import { requireCustomer } from "../middleware/requireCustomer.js";
import { createOrder, listOrders } from "../services/orderService.js";

export const orderRoutes = Router();

orderRoutes.get("/", requireCustomer, async (request, response) => {
  response.json(await listOrders(request.customer.id));
});

orderRoutes.post("/", requireCustomer, async (request, response) => {
  const result = await createOrder(request.customer.id, request.body ?? {});

  if (result.error) {
    return response.status(result.status).json({ error: result.error });
  }

  return response.status(result.status).json(result.order);
});