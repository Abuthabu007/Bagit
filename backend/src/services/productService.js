const products = [
  {
    id: "p-1001",
    name: "Mechanical Keyboard",
    priceCents: 6999,
    currency: "USD",
    stock: 12,
  },
  {
    id: "p-1002",
    name: "Wireless Mouse",
    priceCents: 2499,
    currency: "USD",
    stock: 20,
  },
];

export function listProducts() {
  return products;
}

export function findProductById(productId) {
  return products.find((product) => product.id === productId);
}