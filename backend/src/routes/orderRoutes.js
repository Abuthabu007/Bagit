import { Router } from "express";
import { createOrder, listOrders } from "../services/orderService.js";

export const orderRoutes = Router();

orderRoutes.get("/", (_request, response) => {
  response.json(listOrders());
});

orderRoutes.post("/", (request, response) => {
  const result = createOrder(request.body ?? {});

  if (result.error) {
    return response.status(result.status).json({ error: result.error });
  }

  return response.status(result.status).json(result.order);
});