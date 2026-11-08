CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_number text;

WITH numbered_orders AS (
  SELECT id,
         row_number() OVER (ORDER BY created_at, id) AS serial_number,
         floor(random() * 1000000)::bigint AS random_value
  FROM orders
  WHERE order_number IS NULL
)
UPDATE orders AS target
SET order_number =
  substr(sequence_digits.value, 1, 4) || '-' ||
  substr(sequence_digits.value, 5, 3) || '-' ||
  substr(sequence_digits.value, 8, 4) || '-' ||
  substr(random_digits.value, 1, 3) || '-' ||
  substr(random_digits.value, 4, 3)
FROM numbered_orders
CROSS JOIN LATERAL (
  SELECT lpad(numbered_orders.serial_number::text, 11, '0') AS value
) AS sequence_digits
CROSS JOIN LATERAL (
  SELECT lpad(numbered_orders.random_value::text, 6, '0') AS value
) AS random_digits
WHERE target.id = numbered_orders.id;

ALTER TABLE orders
  ALTER COLUMN order_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_idx
  ON orders (order_number);

DO $$
DECLARE
  existing_orders bigint;
BEGIN
  SELECT count(*) INTO existing_orders FROM orders;
  PERFORM setval('order_number_seq', GREATEST(existing_orders, 1), existing_orders > 0);
END
$$;
