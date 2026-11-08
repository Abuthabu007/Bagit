UPDATE products
SET price_cents = CASE id
      WHEN 'p-1001' THEN 549900
      WHEN 'p-1002' THEN 179900
    END,
    currency = 'INR'
WHERE id IN ('p-1001', 'p-1002')
  AND currency = 'USD';

INSERT INTO products (id, name, price_cents, currency, stock, category_id)
VALUES
  ('p-2001', 'Stainless Steel Water Bottle', 89900, 'INR', 30, 'home-kitchen'),
  ('p-3001', 'Everyday Cotton Tote Bag', 59900, 'INR', 25, 'fashion'),
  ('p-4001', 'Aloe Vera Face Wash', 24900, 'INR', 40, 'beauty'),
  ('p-5001', 'Masala Chai Tea', 34900, 'INR', 50, 'grocery')
ON CONFLICT (id) DO NOTHING;
