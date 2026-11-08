import { useEffect, useState } from "react";
import "./App.css";

async function fetchProducts() {
  const response = await fetch("/api/products");

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

function App() {
  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orderError, setOrderError] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [submittingProductId, setSubmittingProductId] = useState("");

  useEffect(() => {
    async function loadProducts() {
      try {
        setProducts(await fetchProducts());
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  async function handleOrderSubmit(event, product) {
    event.preventDefault();
    setOrderError("");
    setOrderMessage("");
    setSubmittingProductId(product.id);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity: Number(quantities[product.id] ?? 1),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? `Request failed with status ${response.status}`);
      }

      setOrderMessage(
        `Order placed for ${result.quantity} × ${result.productName}. Order ID: ${result.id}`,
      );

      try {
        setProducts(await fetchProducts());
      } catch (refreshError) {
        setOrderError(
          `The order was placed, but stock could not be refreshed: ${refreshError.message}`,
        );
      }
    } catch (requestError) {
      setOrderError(requestError.message);
    } finally {
      setSubmittingProductId("");
    }
  }

  return (
    <main className="page">
      <h1>Order &amp; Inventory</h1>
      <p className="subtitle">Product catalogue</p>

      {loading && <p role="status">Loading products...</p>}
      {error && <p role="alert">Could not load products: {error}</p>}
      {orderError && <p role="alert">{orderError}</p>}
      {orderMessage && <p role="status">{orderMessage}</p>}

      {!loading && !error && (
        <section className="products" aria-label="Products">
          {products.map((product) => (
            <article className="product-card" key={product.id}>
              <h2>{product.name}</h2>
              <p>
                ${(product.priceCents / 100).toFixed(2)} {product.currency}
              </p>
              <p>{product.stock} in stock</p>
              <form onSubmit={(event) => handleOrderSubmit(event, product)}>
                <label htmlFor={`quantity-${product.id}`}>Quantity</label>
                <input
                  id={`quantity-${product.id}`}
                  type="number"
                  min="1"
                  max={product.stock}
                  step="1"
                  value={quantities[product.id] ?? "1"}
                  onChange={(event) =>
                    setQuantities({
                      ...quantities,
                      [product.id]: event.target.value,
                    })
                  }
                  required
                />
                <button
                  type="submit"
                  disabled={product.stock < 1 || submittingProductId !== ""}
                >
                  {submittingProductId === product.id ? "Placing order..." : "Place order"}
                </button>
              </form>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default App;