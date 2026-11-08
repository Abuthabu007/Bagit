import { Router } from "express";
import {
  findProductById,
  listProducts,
} from "../services/productService.js";

export const productRoutes = Router();

productRoutes.get("/", (_request, response) => {
  response.json(listProducts());
});

productRoutes.get("/:productId", (request, response) => {
  const product = findProductById(request.params.productId);

  if (!product) {
    return response.status(404).json({ error: "Product not found" });
  }

  return response.json(product);
});