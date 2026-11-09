import { pool } from "../db/pool.js";

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    currency: row.currency.trim(),
    stock: row.stock,
    categoryId: row.category_id,
    categoryName: row.category_name,
  };
}

export async function listCategories() {
  const result = await pool.query(
    `SELECT id, name, description, icon
     FROM categories
     ORDER BY display_order`,
  );
  return result.rows;
}

export async function listProducts({ categoryId, search } = {}) {
  const result = await pool.query(
    `SELECT p.id, p.name, p.price_cents, p.currency, p.stock,
            p.category_id, c.name AS category_name
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE ($1::text IS NULL OR p.category_id = $1)
       AND ($2::text IS NULL OR p.name ILIKE '%' || $2 || '%')
     ORDER BY p.id`,
    [categoryId || null, search?.trim() || null],
  );
  return result.rows.map(mapProduct);
}

export async function findProductById(productId) {
  const result = await pool.query(
    `SELECT p.id, p.name, p.price_cents, p.currency, p.stock,
            p.category_id, c.name AS category_name
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1`,
    [productId],
  );
  return result.rows[0] ? mapProduct(result.rows[0]) : undefined;
}

function validateInventoryItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
    return { status: 400, error: "Inventory request must contain between 1 and 50 items" };
  }

  const seen = new Set();
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
    if (seen.has(item.productId)) {
      return {
        status: 400,
        error: "Each product can only appear once in an inventory request",
      };
    }
    seen.add(item.productId);
  }

  return { items };
}

export async function reserveInventory(input) {
  const validation = validateInventoryItems(input);
  if (validation.error) {
    return { status: 400, error: validation.error };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT p.id, p.name, p.price_cents, p.currency, p.stock
       FROM products p
       WHERE p.id = ANY($1::text[])
       ORDER BY p.id
       FOR UPDATE`,
      [validation.items.map((item) => item.productId)],
    );
    const products = new Map(result.rows.map((product) => [product.id, product]));

    if (products.size !== validation.items.length) {
      await client.query("ROLLBACK");
      return { status: 404, error: "One or more products could not be found" };
    }

    for (const item of validation.items) {
      const product = products.get(item.productId);
      if (product.stock < item.quantity) {
        await client.query("ROLLBACK");
        return { status: 409, error: `Not enough stock available for ${product.name}` };
      }
    }

    const currencies = new Set(
      [...products.values()].map((product) => product.currency.trim()),
    );
    if (currencies.size !== 1) {
      await client.query("ROLLBACK");
      return { status: 409, error: "Products in one order must use the same currency" };
    }

    const reservedItems = validation.items.map((item) => {
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

    for (const item of reservedItems) {
      await client.query(
        "UPDATE products SET stock = stock - $1 WHERE id = $2",
        [item.quantity, item.productId],
      );
    }

    await client.query("COMMIT");
    return { items: reservedItems };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseInventory(input) {
  const validation = validateInventoryItems(input);
  if (validation.error) {
    return { status: 400, error: validation.error };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const productIds = validation.items.map((item) => item.productId);
    const result = await client.query(
      `SELECT id
       FROM products
       WHERE id = ANY($1::text[])
       ORDER BY id
       FOR UPDATE`,
      [productIds],
    );
    if (result.rowCount !== validation.items.length) {
      await client.query("ROLLBACK");
      return { status: 404, error: "One or more products could not be found" };
    }

    for (const item of validation.items) {
      await client.query(
        "UPDATE products SET stock = stock + $1 WHERE id = $2",
        [item.quantity, item.productId],
      );
    }
    await client.query("COMMIT");
    return {};
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}