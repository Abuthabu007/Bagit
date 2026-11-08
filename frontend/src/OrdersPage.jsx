import AccountMenu from "./AccountMenu.jsx";

function formatCurrency(cents, currency) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatOrderDate(value) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function OrdersPage({
  customer,
  orders,
  ordersLoading,
  ordersError,
  onBack,
  onViewCart,
  onShop,
  accountMenuItems,
  cartCount,
}) {
  return (
    <main className="page storefront-page">
      <header className="market-header">
        <button className="market-brand" type="button" onClick={onShop}>
          <span className="brand-mark" aria-hidden="true">B</span>
          <span className="brand-name">Bag<span>it</span></span>
        </button>
        <div className="store-account">
          {customer ? (
            <>
              <button
                className="cart-button"
                type="button"
                onClick={onViewCart}
                aria-label={`View cart with ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
              >
                Cart <span>{cartCount}</span>
              </button>
              <AccountMenu name={customer.name} items={accountMenuItems} />
            </>
          ) : (
            <button className="text-button" type="button" onClick={onBack}>
              Login / Sign up
            </button>
          )}
        </div>
      </header>

      <button className="text-button profile-back-button" type="button" onClick={onBack}>
        ← Back to shopping
      </button>

      <section className="profile-page" aria-labelledby="orders-page-title">
        <div className="profile-page-heading">
          <p className="eyebrow">YOUR BAGIT ACCOUNT</p>
          <h1 id="orders-page-title">Your orders</h1>
          <p>Review your purchases, order status, and totals.</p>
        </div>

        <section className="profile-orders-card orders-page-card" aria-labelledby="orders-list-title">
          <div className="profile-card-heading profile-orders-heading">
            <div>
              <h2 id="orders-list-title">Order history</h2>
              <p>All your orders, newest first</p>
            </div>
            <span className="profile-order-count">
              {orders.length} {orders.length === 1 ? "order" : "orders"}
            </span>
          </div>

          {!customer && <p role="alert">Sign in to view your personal order history.</p>}
          {customer && ordersLoading && <p role="status">Loading your orders...</p>}
          {customer && !ordersLoading && ordersError && (
            <p role="alert">Could not load your orders: {ordersError}</p>
          )}
          {customer && !ordersLoading && !ordersError && orders.length === 0 && (
            <div className="profile-empty-orders">
              <span aria-hidden="true">✦</span>
              <strong>No orders yet</strong>
              <p>Your orders will appear here after you check out.</p>
              <button className="secondary-button" type="button" onClick={onShop}>
                Explore products
              </button>
            </div>
          )}

          {customer && !ordersLoading && !ordersError && orders.length > 0 && (
            <ul className="profile-order-list">
              {orders.map((order) => (
                <li key={order.id}>
                  <div className="profile-order-topline">
                    <strong className="profile-order-id">Order {order.id}</strong>
                    <span className={`order-status status-${order.status}`}>
                      {order.status}
                    </span>
                  </div>
                  <ul className="profile-order-items">
                    {order.items.map((item) => (
                      <li key={item.productId}>
                        <span>{item.quantity} × {item.productName}</span>
                        <span>{formatCurrency(item.totalCents, order.currency)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="profile-order-bottomline">
                    <time dateTime={order.createdAt}>
                      {formatOrderDate(order.createdAt)}
                    </time>
                    <strong>{formatCurrency(order.totalCents, order.currency)}</strong>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
