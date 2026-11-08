import { Router } from "express";
import {
  findProductById,
  listProducts,
} from "../services/productService.js";

export const productRoutes = Router();

productRoutes.get("/", async (_request, response) => {
  response.json(await listProducts());
});

productRoutes.get("/:productId", async (request, response) => {
  const product = await findProductById(request.params.productId);

  if (!product) {
    return response.status(404).json({ error: "Product not found" });
  }

  return response.json(product);
});