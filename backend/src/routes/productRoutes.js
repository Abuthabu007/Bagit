import { Router } from "express";
import {
  findProductById,
  listCategories,
  listProducts,
} from "../services/productService.js";

export const productRoutes = Router();

productRoutes.get("/", async (_request, response) => {
  response.json(await listProducts({
    categoryId: typeof _request.query.category === "string"
      ? _request.query.category
      : undefined,
    search: typeof _request.query.search === "string"
      ? _request.query.search
      : undefined,
  }));
});

productRoutes.get("/categories", async (_request, response) => {
  response.json(await listCategories());
});

productRoutes.get("/:productId", async (request, response) => {
  const product = await findProductById(request.params.productId);

  if (!product) {
    return response.status(404).json({ error: "Product not found" });
  }

  return response.json(product);
});