import { randomUUID } from "node:crypto";
import { findProductById } from "./productService.js";

const orders = [];

export function listOrders() {
  return orders;
}

export function createOrder(input = {}) {
  const { productId, quantity } = input;

  if (typeof productId !== "string" || productId.trim() === "") {
    return { status: 400, error: "productId is required" };
  }

  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return { status: 400, error: "quantity must be a positive whole number" };
  }

  const product = findProductById(productId);

  if (!product) {
    return { status: 404, error: "Product not found" };
  }

  if (product.stock < quantity) {
    return { status: 409, error: "Not enough stock available" };
  }

  product.stock -= quantity;

  const order = {
    id: randomUUID(),
    productId: product.id,
    productName: product.name,
    quantity,
    unitPriceCents: product.priceCents,
    totalCents: product.priceCents * quantity,
    currency: product.currency,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  orders.push(order);

  return { status: 201, order };
}