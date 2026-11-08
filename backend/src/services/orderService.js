import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";

export async function listOrders() {
  const result = await pool.query(
    `SELECT o.id, o.status, o.created_at,
            oi.product_id, oi.product_name, oi.quantity,
            oi.unit_price_cents, oi.currency
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     ORDER BY o.created_at DESC`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    totalCents: row.unit_price_cents * row.quantity,
    currency: row.currency.trim(),
    status: row.status,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function createOrder(input = {}) {
  const { productId, quantity } = input;

  if (typeof productId !== "string" || productId.trim() === "") {
    return { status: 400, error: "productId is required" };
  }

  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return { status: 400, error: "quantity must be a positive whole number" };
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const productResult = await client.query(
      `SELECT id, name, price_cents, currency, stock
       FROM products
       WHERE id = $1
       FOR UPDATE`,
      [productId],
    );
    const product = productResult.rows[0];

    if (!product) {
      await client.query("ROLLBACK");
      return { status: 404, error: "Product not found" };
    }

    if (product.stock < quantity) {
      await client.query("ROLLBACK");
      return { status: 409, error: "Not enough stock available" };
    }

    const orderId = randomUUID();
    const orderResult = await client.query(
      `INSERT INTO orders (id, status)
       VALUES ($1, 'pending')
       RETURNING created_at`,
      [orderId],
    );

    await client.query(
      `INSERT INTO order_items (
         order_id, product_id, product_name, quantity, unit_price_cents, currency
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        orderId,
        product.id,
        product.name,
        quantity,
        product.price_cents,
        product.currency,
      ],
    );

    await client.query(
      `UPDATE products
       SET stock = stock - $1
       WHERE id = $2`,
      [quantity, product.id],
    );

    await client.query("COMMIT");

    return {
      status: 201,
      order: {
        id: orderId,
        productId: product.id,
        productName: product.name,
        quantity,
        unitPriceCents: product.price_cents,
        totalCents: product.price_cents * quantity,
        currency: product.currency.trim(),
        status: "pending",
        createdAt: orderResult.rows[0].created_at.toISOString(),
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}