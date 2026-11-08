import { randomInt, randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";

export function formatOrderNumber(sequenceValue) {
  const sequenceDigits = String(sequenceValue).padStart(11, "0");
  if (sequenceDigits.length !== 11) {
    throw new Error("Order number sequence exceeded its 11-digit capacity");
  }

  const randomDigits = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return [
    sequenceDigits.slice(0, 4),
    sequenceDigits.slice(4, 7),
    sequenceDigits.slice(7, 11),
    randomDigits.slice(0, 3),
    randomDigits.slice(3),
  ].join("-");
}

export async function listOrders(customerId) {
  const result = await pool.query(
    `SELECT o.id, o.order_number, o.status, o.created_at,
            oi.product_id, oi.product_name, oi.quantity,
            oi.unit_price_cents, oi.currency
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.customer_id = $1
     ORDER BY o.created_at DESC`,
    [customerId],
  );

  const orders = new Map();
  for (const row of result.rows) {
    let order = orders.get(row.id);
    if (!order) {
      order = {
        id: row.order_number,
        items: [],
        totalCents: 0,
        currency: row.currency.trim(),
        status: row.status,
        createdAt: row.created_at.toISOString(),
      };
      orders.set(row.id, order);
    }

    const item = {
      productId: row.product_id,
      productName: row.product_name,
      quantity: row.quantity,
      unitPriceCents: row.unit_price_cents,
      totalCents: row.unit_price_cents * row.quantity,
    };
    order.items.push(item);
    order.totalCents += item.totalCents;
  }

  return [...orders.values()];
}

export async function createOrder(customerId, input = {}) {
  const items = Array.isArray(input.items)
    ? input.items
    : [{ productId: input.productId, quantity: input.quantity }];

  if (items.length < 1 || items.length > 50) {
    return { status: 400, error: "An order must contain between 1 and 50 items" };
  }

  const requestedItems = [];
  const productIds = new Set();
  for (const item of items) {
    if (
      typeof item?.productId !== "string" ||
      item.productId.trim() === "" ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1
    ) {
      return {
        status: 400,
        error: "Each item needs a productId and a positive whole-number quantity",
      };
    }
    if (productIds.has(item.productId)) {
      return { status: 400, error: "Each product can only appear once in an order" };
    }
    productIds.add(item.productId);
    requestedItems.push({ productId: item.productId, quantity: item.quantity });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const productResult = await client.query(
      `SELECT id, name, price_cents, currency, stock
       FROM products
       WHERE id = ANY($1::text[])
       ORDER BY id
       FOR UPDATE`,
      [requestedItems.map((item) => item.productId)],
    );
    const products = new Map(productResult.rows.map((product) => [product.id, product]));

    if (products.size !== requestedItems.length) {
      await client.query("ROLLBACK");
      return { status: 404, error: "One or more products could not be found" };
    }

    for (const item of requestedItems) {
      const product = products.get(item.productId);
      if (product.stock < item.quantity) {
        await client.query("ROLLBACK");
        return {
          status: 409,
          error: `Not enough stock available for ${product.name}`,
        };
      }
    }

    const currencies = new Set(
      [...products.values()].map((product) => product.currency.trim()),
    );
    if (currencies.size !== 1) {
      await client.query("ROLLBACK");
      return { status: 409, error: "Products in one order must use the same currency" };
    }

    const orderId = randomUUID();
    const sequenceResult = await client.query(
      "SELECT nextval('order_number_seq') AS sequence_value",
    );
    const orderNumber = formatOrderNumber(sequenceResult.rows[0].sequence_value);
    const orderResult = await client.query(
      `INSERT INTO orders (id, order_number, customer_id, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING created_at`,
      [orderId, orderNumber, customerId],
    );

    const orderItems = requestedItems.map((item) => {
      const product = products.get(item.productId);
      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPriceCents: product.price_cents,
        totalCents: product.price_cents * item.quantity,
        currency: product.currency.trim(),
      };
    });

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (
           order_id, product_id, product_name, quantity, unit_price_cents, currency
         )
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orderId,
          item.productId,
          item.productName,
          item.quantity,
          item.unitPriceCents,
          item.currency,
        ],
      );
      await client.query(
        `UPDATE products
         SET stock = stock - $1
         WHERE id = $2`,
        [item.quantity, item.productId],
      );
    }

    await client.query("COMMIT");

    return {
      status: 201,
      order: {
        id: orderNumber,
        items: orderItems,
        totalCents: orderItems.reduce((total, item) => total + item.totalCents, 0),
        currency: orderItems[0].currency,
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