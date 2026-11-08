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