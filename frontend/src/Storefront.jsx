import { useEffect, useState } from "react";
import AccountMenu from "./AccountMenu.jsx";
import OrdersPage from "./OrdersPage.jsx";
import ProductGallery from "./ProductGallery.jsx";
import ProfilePage from "./ProfilePage.jsx";

function formatCurrency(cents, currency) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

async function fetchProducts() {
  const response = await fetch("/api/products", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

async function fetchCategories() {
  const response = await fetch("/api/products/categories", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

async function fetchOrders() {
  const response = await fetch("/api/orders", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

function getProductIdFromPath() {
  const match = window.location.pathname.match(/^\/products\/([^/]+)\/?$/);
  if (!match) {
    return "";
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

function isProfilePath() {
  return window.location.pathname === "/profile";
}

function isOrdersPath() {
  return window.location.pathname === "/orders";
}

export default function Storefront({ customer, onBack, onLogout }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [photoAttributions, setPhotoAttributions] = useState({});
  const [photoAttributionError, setPhotoAttributionError] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [reviewingOrder, setReviewingOrder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orderError, setOrderError] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [viewedProductId, setViewedProductId] = useState(getProductIdFromPath);
  const [productQuantity, setProductQuantity] = useState(1);
  const [profilePageOpen, setProfilePageOpen] = useState(isProfilePath);
  const [ordersPageOpen, setOrdersPageOpen] = useState(isOrdersPath);

  const cartItems = cart.map((item) => ({
    ...item,
    product: products.find((product) => product.id === item.productId),
  }));
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartSubtotalCents = cartItems.reduce(
    (total, item) => total + (item.product?.priceCents ?? 0) * item.quantity,
    0,
  );
  const cartCurrency = cartItems.find((item) => item.product)?.product.currency ?? "INR";

  async function refreshOrders() {
    setOrders(await fetchOrders());
    setOrdersError("");
  }

  useEffect(() => {
    async function loadStore() {
      try {
        setProducts(await fetchProducts());
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }

      try {
        setCategories(await fetchCategories());
      } catch (requestError) {
        setError(requestError.message);
      }

      try {
        const response = await fetch("/images/products/ATTRIBUTION.json");
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const records = await response.json();
        setPhotoAttributions(
          Object.fromEntries(records.map((record) => [record.file, record])),
        );
        setPhotoAttributionError("");
      } catch (requestError) {
        setPhotoAttributionError(requestError.message);
      }

      if (customer) {
        try {
          await refreshOrders();
        } catch (requestError) {
          setOrdersError(requestError.message);
        } finally {
          setOrdersLoading(false);
        }
      } else {
        setOrdersLoading(false);
      }
    }

    loadStore();
  }, [customer]);

  useEffect(() => {
    function syncProductRoute() {
      setViewedProductId(getProductIdFromPath());
      setProfilePageOpen(isProfilePath());
      setOrdersPageOpen(isOrdersPath());
      setProductQuantity(1);
    }

    window.addEventListener("popstate", syncProductRoute);
    return () => window.removeEventListener("popstate", syncProductRoute);
  }, []);

  const visibleProducts = products.filter((product) => {
    const matchesCategory =
      activeCategory === "all" || product.categoryId === activeCategory;
    const matchesSearch = product.name
      .toLocaleLowerCase()
      .includes(searchQuery.trim().toLocaleLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeCategoryName = categories.find(
    (category) => category.id === activeCategory,
  )?.name;

  function addToCart(product, quantity = 1) {
    setOrderError("");
    setOrderMessage("");
    setReviewingOrder(false);
    const currentItem = cart.find((item) => item.productId === product.id);
    const nextQuantity = (currentItem?.quantity ?? 0) + quantity;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || nextQuantity > product.stock) {
      setOrderError(`Only ${product.stock} units of ${product.name} are available.`);
      return;
    }

    setCart((currentCart) => {
      const latestItem = currentCart.find((item) => item.productId === product.id);
      if ((latestItem?.quantity ?? 0) + quantity > product.stock) {
        return currentCart;
      }

      if (latestItem) {
        return currentCart.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }
      return [...currentCart, { productId: product.id, quantity }];
    });
    setOrderMessage(`Added ${quantity} × ${product.name} to your cart.`);
  }

  function openProduct(product) {
    window.history.pushState(
      { bagitProductPage: true },
      "",
      `/products/${encodeURIComponent(product.id)}`,
    );
    setViewedProductId(product.id);
    setProfilePageOpen(false);
    setOrdersPageOpen(false);
    setProductQuantity(1);
    setOrderError("");
    setOrderMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeProduct() {
    if (window.history.state?.bagitProductPage) {
      window.history.back();
      return;
    }

    window.history.replaceState(window.history.state, "", "/");
    setViewedProductId("");
    setProfilePageOpen(false);
    setOrdersPageOpen(false);
    setProductQuantity(1);
  }

  function openProfile() {
    window.history.pushState(
      { bagitProfilePage: true },
      "",
      "/profile",
    );
    setViewedProductId("");
    setProfilePageOpen(true);
    setOrdersPageOpen(false);
    setOrderError("");
    setOrderMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeProfile() {
    if (window.history.state?.bagitProfilePage) {
      window.history.back();
      return;
    }

    window.history.replaceState(window.history.state, "", "/");
    setProfilePageOpen(false);
  }

  function openOrders() {
    window.history.pushState(
      { bagitOrdersPage: true },
      "",
      "/orders",
    );
    setViewedProductId("");
    setProfilePageOpen(false);
    setOrdersPageOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeOrders() {
    if (window.history.state?.bagitOrdersPage) {
      window.history.back();
      return;
    }

    window.history.replaceState(window.history.state, "", "/");
    setOrdersPageOpen(false);
  }

  function signOut() {
    window.history.replaceState(window.history.state, "", "/");
    setViewedProductId("");
    setProfilePageOpen(false);
    setOrdersPageOpen(false);
    onLogout();
  }

  function changeCartQuantity(productId, change) {
    const product = products.find((item) => item.id === productId);
    const cartItem = cart.find((item) => item.productId === productId);
    const nextQuantity = (cartItem?.quantity ?? 0) + change;
    if (product && nextQuantity > product.stock) {
      setOrderError(`Only ${product.stock} units of ${product.name} are available.`);
      return;
    }

    setOrderError("");
    setReviewingOrder(false);
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + change }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  async function handleOrderSubmit(event) {
    event.preventDefault();
    setOrderError("");
    setOrderMessage("");
    setSubmittingOrder(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map(({ productId, quantity }) => ({
            productId,
            quantity,
          })),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? `Request failed with status ${response.status}`);
      }

      setOrderMessage(`Order placed. Total: ${formatCurrency(result.totalCents, result.currency)}. Order ID: ${result.id}`);
      setCart([]);
      setReviewingOrder(false);

      const refreshErrors = [];
      try {
        setProducts(await fetchProducts());
      } catch (refreshError) {
        refreshErrors.push(`inventory could not be refreshed: ${refreshError.message}`);
      }

      try {
        await refreshOrders();
      } catch (refreshError) {
        refreshErrors.push(`order history could not be refreshed: ${refreshError.message}`);
      }

      if (refreshErrors.length > 0) {
        setOrderError(`Order placed, but ${refreshErrors.join("; ")}.`);
      }
    } catch (requestError) {
      setOrderError(requestError.message);
    } finally {
      setSubmittingOrder(false);
    }
  }

  function scrollToCart() {
    document.getElementById("shopping-cart")?.scrollIntoView({ behavior: "smooth" });
  }

  function openCartFromOtherPage(closePage) {
    closePage();
    window.setTimeout(scrollToCart, 150);
  }

  function storefrontAccountItems() {
    return [
      { label: "My profile", onSelect: openProfile },
      { label: "Your cart", onSelect: scrollToCart },
      { label: "Recent orders", onSelect: openOrders },
      { label: "Sign out", onSelect: signOut, danger: true },
    ];
  }

  const viewedProduct = products.find((product) => product.id === viewedProductId);
  const viewedCategory = categories.find(
    (category) => category.id === viewedProduct?.categoryId,
  );
  const quantityInCart =
    cart.find((item) => item.productId === viewedProduct?.id)?.quantity ?? 0;
  const remainingProductStock = Math.max(
    0,
    (viewedProduct?.stock ?? 0) - quantityInCart,
  );

  if (profilePageOpen) {
    return (
      <ProfilePage
        customer={customer}
        cartCount={cartCount}
        onBack={closeProfile}
        onViewOrders={openOrders}
        onViewCart={() => openCartFromOtherPage(closeProfile)}
        onShop={closeProfile}
        accountMenuItems={[
          { label: "Shop products", onSelect: closeProfile },
          { label: "Your cart", onSelect: () => openCartFromOtherPage(closeProfile) },
          { label: "Recent orders", onSelect: openOrders },
          { label: "Sign out", onSelect: signOut, danger: true },
        ]}
      />
    );
  }

  if (ordersPageOpen) {
    return (
      <OrdersPage
        customer={customer}
        orders={orders}
        ordersLoading={ordersLoading}
        ordersError={ordersError}
        cartCount={cartCount}
        onBack={closeOrders}
        onViewCart={() => openCartFromOtherPage(closeOrders)}
        onShop={closeOrders}
        accountMenuItems={[
          { label: "My profile", onSelect: openProfile },
          { label: "Your cart", onSelect: () => openCartFromOtherPage(closeOrders) },
          { label: "Sign out", onSelect: signOut, danger: true },
        ]}
      />
    );
  }

  if (viewedProductId) {
    return (
      <main className="page storefront-page">
        <header className="market-header">
          <button className="market-brand" type="button" onClick={closeProduct}>
            <span className="brand-mark" aria-hidden="true">B</span>
            <span className="brand-name">Bag<span>it</span></span>
          </button>
          <div className="store-account">
            {customer ? (
              <>
                <button
                  className="cart-button"
                  type="button"
                  onClick={() => openCartFromOtherPage(closeProduct)}
                  aria-label={`View cart with ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
                >
                  Cart <span>{cartCount}</span>
                </button>
                <AccountMenu
                  name={customer.name}
                  items={[
                    { label: "My profile", onSelect: openProfile },
                    { label: "Your cart", onSelect: () => openCartFromOtherPage(closeProduct) },
                    { label: "Recent orders", onSelect: openOrders },
                    { label: "Sign out", onSelect: signOut, danger: true },
                  ]}
                />
              </>
            ) : (
              <button className="text-button" type="button" onClick={onBack}>
                Login / Sign up
              </button>
            )}
          </div>
        </header>

        <button className="text-button product-back-button" type="button" onClick={closeProduct}>
          ← Back to products
        </button>

        {loading && <p role="status">Loading product...</p>}
        {!loading && error && <p role="alert">Could not load products: {error}</p>}
        {!loading && !error && !viewedProduct && (
          <section className="product-not-found">
            <h1>Product not found</h1>
            <p>This product may have been removed from the catalogue.</p>
            <button className="secondary-button" type="button" onClick={closeProduct}>
              Back to products
            </button>
          </section>
        )}

        {!loading && !error && viewedProduct && (
          <section className="product-detail" aria-labelledby="product-detail-title">
            <div className="product-detail-gallery">
              <ProductGallery
                key={viewedProduct.id}
                product={viewedProduct}
                categoryIcon={viewedCategory?.icon ?? "✦"}
                attributions={photoAttributions}
                detail
              />
            </div>
            <div className="product-detail-info">
              <p className="eyebrow">{viewedCategory?.name ?? viewedProduct.categoryName}</p>
              <h1 id="product-detail-title">{viewedProduct.name}</h1>
              <p className="product-detail-price">
                {formatCurrency(viewedProduct.priceCents, viewedProduct.currency)}
              </p>
              <p className="product-detail-stock" role="status">
                {remainingProductStock > 0
                  ? `${remainingProductStock} available${quantityInCart > 0 ? ` · ${quantityInCart} in your cart` : ""}`
                  : "Currently unavailable"}
              </p>
              {viewedCategory?.description && (
                <p className="product-detail-description">{viewedCategory.description}.</p>
              )}

              {customer ? (
                <>
                  <p className="product-delivery-note">
                    Delivering to <strong>{customer.address?.pincode ?? "your saved address"}</strong>
                  </p>
                  <div className="product-purchase">
                    <label htmlFor="product-quantity">Quantity</label>
                    <input
                      id="product-quantity"
                      type="number"
                      min="1"
                      max={remainingProductStock}
                      step="1"
                      value={productQuantity}
                      disabled={remainingProductStock < 1}
                      onChange={(event) => {
                        const nextQuantity = Number(event.target.value);
                        if (
                          event.target.value === "" ||
                          (Number.isSafeInteger(nextQuantity) &&
                            nextQuantity >= 1 &&
                            nextQuantity <= remainingProductStock)
                        ) {
                          setProductQuantity(event.target.value === "" ? "" : nextQuantity);
                        }
                      }}
                    />
                    <button
                      className="primary-button"
                      type="button"
                      disabled={
                        remainingProductStock < 1 ||
                        !Number.isSafeInteger(Number(productQuantity)) ||
                        Number(productQuantity) < 1 ||
                        Number(productQuantity) > remainingProductStock
                      }
                      onClick={() => addToCart(viewedProduct, Number(productQuantity))}
                    >
                      {remainingProductStock < 1 ? "Out of stock" : "Add to cart"}
                    </button>
                  </div>
                </>
              ) : (
                <button className="primary-button" type="button" onClick={onBack}>
                  Login to shop
                </button>
              )}

              {orderError && <p role="alert">{orderError}</p>}
              {orderMessage && <p role="status">{orderMessage}</p>}

              <dl className="product-facts">
                <div>
                  <dt>Category</dt>
                  <dd>{viewedProduct.categoryName}</dd>
                </div>
                <div>
                  <dt>Product ID</dt>
                  <dd>{viewedProduct.id}</dd>
                </div>
              </dl>
            </div>
          </section>
        )}
      </main>
    );
  }

  return (
    <main className="page storefront-page">
      <header className="market-header">
        <button className="market-brand" type="button" onClick={() => setActiveCategory("all")}>
          <span className="brand-mark" aria-hidden="true">B</span>
          <span className="brand-name">Bag<span>it</span></span>
        </button>
        <label className="market-search">
          <span className="visually-hidden">Search products</span>
          <input
            type="search"
            placeholder="Search for products"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <span aria-hidden="true">⌕</span>
        </label>
        <div className="store-account">
          {customer ? (
            <>
              <button
                className="cart-button"
                type="button"
                onClick={scrollToCart}
                aria-label={`View cart with ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
              >
                Cart <span>{cartCount}</span>
              </button>
              <span className="delivery-greeting">
                Delivering to <strong>{customer.address?.pincode ?? "your address"}</strong>
              </span>
              <AccountMenu name={customer.name} items={storefrontAccountItems()} />
            </>
          ) : (
            <>
              <span className="store-preview-label">Catalogue preview</span>
              <button className="text-button" type="button" onClick={onBack}>
                Login / Sign up
              </button>
            </>
          )}
        </div>
      </header>

      <nav className="category-nav" aria-label="Shop categories">
        <button
          className={activeCategory === "all" ? "category-link active" : "category-link"}
          type="button"
          onClick={() => setActiveCategory("all")}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            className={activeCategory === category.id ? "category-link active" : "category-link"}
            key={category.id}
            type="button"
            onClick={() => setActiveCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </nav>

      <section className="market-hero">
        <div className="hero-copy">
          <p className="eyebrow">YOUR EVERYDAY, BAGGED</p>
          <h1>Good finds.<br />Good feels.</h1>
          <p>Discover handy picks for your home, work, and everything in between.</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setActiveCategory("electronics");
              document.getElementById("market-products")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Explore products
          </button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="hero-orbit orbit-one" />
          <span className="hero-orbit orbit-two" />
          <span className="hero-bag">B<span>!</span></span>
          <span className="hero-spark">✦</span>
        </div>
        <p className="hero-footnote">Don’t think twice, just bag it.</p>
      </section>

      {loading && <p role="status">Loading products...</p>}
      {error && <p role="alert">Could not load products: {error}</p>}
      {orderError && <p role="alert">{orderError}</p>}
      {orderMessage && <p role="status">{orderMessage}</p>}
      {photoAttributionError && (
        <p role="alert">Product photo credits could not be loaded: {photoAttributionError}</p>
      )}

      <section className="category-section" aria-labelledby="categories-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A LITTLE BIT OF EVERYTHING</p>
            <h2 id="categories-heading">Shop by category</h2>
          </div>
          <button className="text-button" type="button" onClick={() => setActiveCategory("all")}>
            View all
          </button>
        </div>
        <div className="category-cards">
          {categories.map((category) => {
            const count = products.filter(
              (product) => product.categoryId === category.id,
            ).length;
            return (
              <button
                className={activeCategory === category.id ? "category-card selected" : "category-card"}
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
              >
                <span className="category-icon" aria-hidden="true">{category.icon}</span>
                <strong>{category.name}</strong>
                <span className="category-description">{category.description}</span>
                <span className="category-count">
                  {count > 0 ? `${count} ${count === 1 ? "item" : "items"}` : "Coming soon"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {!loading && !error && (
        <section id="market-products" className="market-products" aria-labelledby="products-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PICKS FOR YOU</p>
              <h2 id="products-heading">
                {searchQuery.trim()
                  ? `Results for “${searchQuery.trim()}”`
                  : activeCategoryName ?? "Popular picks"}
              </h2>
            </div>
            <span className="results-count">{visibleProducts.length} products</span>
          </div>
          {visibleProducts.length === 0 ? (
            <div className="empty-products">
              <span aria-hidden="true">✦</span>
              <h3>No products here just yet</h3>
              <p>Try another category or search. We’re adding more good finds soon.</p>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                }}
              >
                Browse all products
              </button>
            </div>
          ) : (
          <div className="products">
          {visibleProducts.map((product) => (
            <article className="product-card" key={product.id}>
              <ProductGallery
                product={product}
                categoryIcon={categories.find((category) => category.id === product.categoryId)?.icon ?? "✦"}
                attributions={photoAttributions}
                onOpen={() => openProduct(product)}
              />
              <div className="product-details">
                <p className="product-category">{product.categoryName}</p>
                <h3>
                  <button
                    className="product-title-link"
                    type="button"
                    onClick={() => openProduct(product)}
                  >
                    {product.name}
                  </button>
                </h3>
                <p className="product-price">{formatCurrency(product.priceCents, product.currency)}</p>
                <p className="product-stock">
                  {product.stock > 0 ? `${product.stock} in stock` : "Currently unavailable"}
                </p>
                <button
                  type="button"
                  disabled={!customer || product.stock < 1 || submittingOrder}
                  onClick={() => addToCart(product)}
                >
                  {!customer ? "Login to shop" : product.stock < 1 ? "Out of stock" : "Add to cart"}
                </button>
              </div>
            </article>
          ))}
          </div>
          )}
        </section>
      )}

      {customer && (
        <section id="shopping-cart" className="shopping-cart" aria-labelledby="cart-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{reviewingOrder ? "CHECK BEFORE YOU PLACE IT" : "YOUR BAGIT BASKET"}</p>
              <h2 id="cart-heading">{reviewingOrder ? "Order summary" : "Your cart"}</h2>
            </div>
            <span className="results-count">{cartCount} {cartCount === 1 ? "item" : "items"}</span>
          </div>

          {cart.length === 0 ? (
            <div className="empty-cart">
              <p>Your cart is waiting for something good.</p>
              <button className="secondary-button" type="button" onClick={() => {
                setReviewingOrder(false);
                document.getElementById("market-products")?.scrollIntoView({ behavior: "smooth" });
              }}>
                Continue shopping
              </button>
            </div>
          ) : reviewingOrder ? (
            <form className="order-review" onSubmit={handleOrderSubmit}>
              <div>
                <h3>Items</h3>
                <ul className="cart-lines">
                  {cartItems.map(({ product, productId, quantity }) => (
                    <li key={productId}>
                      <span>{product?.name ?? "Unavailable product"} × {quantity}</span>
                      <strong>
                        {product
                          ? formatCurrency(product.priceCents * quantity, product.currency)
                          : "Unavailable"}
                      </strong>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="delivery-address">
                <h3>Delivering to</h3>
                {customer.address ? (
                  <address>
                    <strong>{customer.name}</strong>
                    <span>{customer.address.addressLine1}</span>
                    <span>{customer.address.city}, {customer.address.state} {customer.address.pincode}</span>
                  </address>
                ) : (
                  <p role="alert">No saved delivery address is available for this account.</p>
                )}
              </div>
              <div className="cart-total">
                <span>Subtotal</span>
                <strong>{formatCurrency(cartSubtotalCents, cartCurrency)}</strong>
              </div>
              <p className="checkout-note">
                Shipping and taxes are not included in this practice checkout. Payment is not enabled yet.
              </p>
              <div className="cart-actions">
                <button className="secondary-button" type="button" onClick={() => setReviewingOrder(false)}>
                  Back to cart
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={submittingOrder || !customer.address || cartItems.some((item) => !item.product)}
                >
                  {submittingOrder ? "Placing order..." : "Place demo order"}
                </button>
              </div>
            </form>
          ) : (
            <>
              {cartItems.map(({ product, productId, quantity }) => (
                <article className="cart-line" key={productId}>
                  <div>
                    <h3>{product?.name ?? "Unavailable product"}</h3>
                    <p>
                      {product
                        ? formatCurrency(product.priceCents, product.currency)
                        : "This product is no longer available"}
                    </p>
                  </div>
                  <div className="cart-quantity">
                    <button
                      type="button"
                      aria-label={`Decrease ${product?.name ?? "item"} quantity`}
                      onClick={() => changeCartQuantity(productId, -1)}
                    >
                      −
                    </button>
                    <span>{quantity}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${product?.name ?? "item"} quantity`}
                      disabled={!product || quantity >= product.stock}
                      onClick={() => changeCartQuantity(productId, 1)}
                    >
                      +
                    </button>
                  </div>
                  <strong>
                    {product
                      ? formatCurrency(product.priceCents * quantity, product.currency)
                      : "Unavailable"}
                  </strong>
                </article>
              ))}
              <div className="cart-total">
                <span>Subtotal</span>
                <strong>{formatCurrency(cartSubtotalCents, cartCurrency)}</strong>
              </div>
              <p className="checkout-note">
                Shipping and taxes are not included. Product prices and stock are checked again when you place the demo order.
              </p>
              <div className="cart-actions">
                <button
                  className="primary-button"
                  type="button"
                  disabled={cartItems.some((item) => !item.product)}
                  onClick={() => setReviewingOrder(true)}
                >
                  Review order
                </button>
              </div>
            </>
          )}
        </section>
      )}

      <footer className="market-footer">
        <button className="text-button" type="button" onClick={onBack}>Back to Bagit</button>
        <span>Made for everyday good finds.</span>
      </footer>
    </main>
  );
}
