CREATE TABLE IF NOT EXISTS categories (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  icon text NOT NULL,
  display_order integer NOT NULL UNIQUE
);

INSERT INTO categories (id, name, description, icon, display_order)
VALUES
  ('electronics', 'Electronics', 'Devices and everyday tech', '⚡', 1),
  ('home-kitchen', 'Home & Kitchen', 'Useful finds for your home', '⌂', 2),
  ('fashion', 'Fashion', 'Everyday style and accessories', '✳', 3),
  ('beauty', 'Beauty & Care', 'Personal care and feel-good finds', '✿', 4),
  ('grocery', 'Grocery', 'Daily essentials for your home', '＋', 5)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id text;

UPDATE products
SET category_id = 'electronics'
WHERE category_id IS NULL;

ALTER TABLE products
  ALTER COLUMN category_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_category_id_fkey'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES categories(id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS products_category_id_idx
  ON products (category_id);
