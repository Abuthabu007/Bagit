INSERT INTO products (id, name, price_cents, currency, stock, category_id)
VALUES
  ('p-1003', 'USB-C Fast Charger', 129900, 'INR', 24, 'electronics'),
  ('p-1004', 'Bluetooth Earbuds', 199900, 'INR', 18, 'electronics'),
  ('p-1005', 'Laptop Sleeve', 79900, 'INR', 20, 'electronics'),
  ('p-2002', 'Ceramic Coffee Mug Set', 69900, 'INR', 22, 'home-kitchen'),
  ('p-2003', 'Cotton Cushion Cover', 44900, 'INR', 28, 'home-kitchen'),
  ('p-2004', 'Bamboo Kitchen Organizer', 99900, 'INR', 15, 'home-kitchen'),
  ('p-3002', 'Classic Cotton T-Shirt', 49900, 'INR', 35, 'fashion'),
  ('p-3003', 'Everyday Canvas Cap', 39900, 'INR', 20, 'fashion'),
  ('p-3004', 'Minimalist Wallet', 79900, 'INR', 16, 'fashion'),
  ('p-4002', 'Daily Moisturizer', 32900, 'INR', 30, 'beauty'),
  ('p-4003', 'Herbal Shampoo', 27900, 'INR', 26, 'beauty'),
  ('p-4004', 'Gentle Hand Cream', 19900, 'INR', 32, 'beauty'),
  ('p-5002', 'Roasted Cashews', 29900, 'INR', 24, 'grocery'),
  ('p-5003', 'Wholegrain Oats', 18900, 'INR', 40, 'grocery'),
  ('p-5004', 'Cold-Pressed Groundnut Oil', 44900, 'INR', 18, 'grocery')
ON CONFLICT (id) DO NOTHING;
