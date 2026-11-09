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

async function requestCatalog(path, items) {
  const catalogUrl = process.env.CATALOG_SERVICE_URL ?? "http://catalog:3000";
  const response = await fetch(`${catalogUrl}/internal/inventory/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Service-Token": process.env.INTERNAL_SERVICE_TOKEN ?? "",
    },
    body: JSON.stringify({ items }),
    signal: AbortSignal.timeout(5000),
  });
  const body = response.status === 204 ? {} : await response.json();
  if (!response.ok) {
    const error = new Error(body.error ?? `Catalog service returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
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

  let reservedItems;
  try {
    ({ items: reservedItems } = await requestCatalog("reserve", requestedItems));
  } catch (error) {
    if (error.status) {
      return { status: error.status, error: error.message };
    }
    console.error("Could not reserve catalog inventory:", error);
    return { status: 503, error: "Catalog service is temporarily unavailable" };
  }

  let client;
  let transactionOpen = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionOpen = true;

    const orderId = randomUUID();
    const sequenceResult = await client.query(
      "SELECT nextval('order_number_seq') AS sequence_value",
    );
    const orderNumber = formatOrderNumber(sequenceResult.rows[0].sequence_value);
    const currency = reservedItems[0].currency;
    const orderResult = await client.query(
      `INSERT INTO orders (id, order_number, customer_id, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING created_at`,
      [orderId, orderNumber, customerId],
    );

    for (const item of reservedItems) {
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
    }

    await client.query("COMMIT");
    transactionOpen = false;
    return {
      status: 201,
      order: {
        id: orderNumber,
        items: reservedItems,
        totalCents: reservedItems.reduce((total, item) => total + item.totalCents, 0),
        currency,
        status: "pending",
        createdAt: orderResult.rows[0].created_at.toISOString(),
      },
    };
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Could not roll back failed order transaction:", rollbackError);
      }
    }
    try {
      await requestCatalog("release", reservedItems);
    } catch (releaseError) {
      console.error("Failed to release catalog inventory after order failure:", releaseError);
      throw new AggregateError(
        [error, releaseError],
        "Order creation failed and catalog inventory compensation also failed",
      );
    }
    throw error;
  } finally {
    client?.release();
  }
}
