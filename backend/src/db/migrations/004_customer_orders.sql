ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);

CREATE INDEX IF NOT EXISTS orders_customer_created_idx
  ON orders (customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;
