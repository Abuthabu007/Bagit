CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  currency char(3) NOT NULL,
  stock integer NOT NULL CHECK (stock >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1;

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY,
  order_number text NOT NULL UNIQUE,
  status text NOT NULL CHECK (
    status IN ('pending', 'confirmed', 'shipped', 'cancelled')
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  currency char(3) NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

INSERT INTO products (id, name, price_cents, currency, stock)
VALUES
  ('p-1001', 'Mechanical Keyboard', 549900, 'INR', 12),
  ('p-1002', 'Wireless Mouse', 179900, 'INR', 20)
ON CONFLICT (id) DO NOTHING;