import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/products");

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        setProducts(data);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  return (
    <main className="page">
      <h1>Order &amp; Inventory</h1>
      <p className="subtitle">Product catalogue</p>

      {loading && <p role="status">Loading products...</p>}
      {error && <p role="alert">Could not load products: {error}</p>}

      {!loading && !error && (
        <section className="products" aria-label="Products">
          {products.map((product) => (
            <article className="product-card" key={product.id}>
              <h2>{product.name}</h2>
              <p>
                ${(product.priceCents / 100).toFixed(2)} {product.currency}
              </p>
              <p>{product.stock} in stock</p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default App;