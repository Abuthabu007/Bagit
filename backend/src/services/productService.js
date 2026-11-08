import { pool } from "../db/pool.js";

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    currency: row.currency.trim(),
    stock: row.stock,
  };
}

export async function listProducts() {
  const result = await pool.query(
    `SELECT id, name, price_cents, currency, stock
     FROM products
     ORDER BY id`,
  );
  return result.rows.map(mapProduct);
}

export async function findProductById(productId) {
  const result = await pool.query(
    `SELECT id, name, price_cents, currency, stock
     FROM products
     WHERE id = $1`,
    [productId],
  );
  return result.rows[0] ? mapProduct(result.rows[0]) : undefined;
}