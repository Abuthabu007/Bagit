import pg from "pg";

const { Pool } = pg;
const schema = process.env.PGSCHEMA ?? "public";

if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
  throw new Error("PGSCHEMA must be a lowercase PostgreSQL schema name");
}

export const pool = new Pool({
  host: process.env.PGHOST ?? "127.0.0.1",
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  options: `-c search_path=${schema}`,
  connectionTimeoutMillis: 2000,
});