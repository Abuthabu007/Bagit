import { Router } from "express";
import { createOrder, listOrders } from "../services/orderService.js";

export const orderRoutes = Router();

orderRoutes.get("/", async (_request, response) => {
  response.json(await listOrders());
});

orderRoutes.post("/", async (request, response) => {
  const result = await createOrder(request.body ?? {});

  if (result.error) {
    return response.status(result.status).json({ error: result.error });
  }

  return response.status(result.status).json(result.order);
});