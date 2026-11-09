BEGIN;

CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS orders;
CREATE SCHEMA IF NOT EXISTS delivery;

ALTER TABLE IF EXISTS public.orders
  DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
ALTER TABLE IF EXISTS public.order_items
  DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE IF EXISTS public.order_items
  DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;

DO $$
BEGIN
  IF to_regclass('public.categories') IS NOT NULL THEN
    ALTER TABLE public.categories SET SCHEMA catalog;
  END IF;
  IF to_regclass('public.products') IS NOT NULL THEN
    ALTER TABLE public.products SET SCHEMA catalog;
  END IF;
  IF to_regclass('public.customers') IS NOT NULL THEN
    ALTER TABLE public.customers SET SCHEMA identity;
  END IF;
  IF to_regclass('public.customer_addresses') IS NOT NULL THEN
    ALTER TABLE public.customer_addresses SET SCHEMA identity;
  END IF;
  IF to_regclass('public.otp_challenges') IS NOT NULL THEN
    ALTER TABLE public.otp_challenges SET SCHEMA identity;
  END IF;
  IF to_regclass('public.customer_sessions') IS NOT NULL THEN
    ALTER TABLE public.customer_sessions SET SCHEMA identity;
  END IF;
  IF to_regclass('public.order_items') IS NOT NULL THEN
    ALTER TABLE public.order_items SET SCHEMA orders;
  END IF;
  IF to_regclass('public.orders') IS NOT NULL THEN
    ALTER TABLE public.orders SET SCHEMA orders;
  END IF;
  IF to_regclass('public.order_number_seq') IS NOT NULL THEN
    ALTER SEQUENCE public.order_number_seq SET SCHEMA orders;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('orders.orders') IS NOT NULL
     AND to_regclass('orders.order_items') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'order_items_order_id_fkey'
         AND conrelid = 'orders.order_items'::regclass
     ) THEN
    ALTER TABLE orders.order_items
      ADD CONSTRAINT order_items_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES orders.orders(id) ON DELETE CASCADE;
  END IF;
END
$$;

COMMIT;
