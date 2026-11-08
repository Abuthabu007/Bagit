import AccountMenu from "./AccountMenu.jsx";

export default function ProfilePage({
  customer,
  onBack,
  onViewOrders,
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

      <section className="profile-page" aria-labelledby="profile-title">
        <div className="profile-page-heading">
          <p className="eyebrow">YOUR BAGIT ACCOUNT</p>
          <h1 id="profile-title">My profile</h1>
          <p>Manage your personal details and saved delivery address.</p>
          <button className="secondary-button profile-orders-link" type="button" onClick={onViewOrders}>
            View order history
          </button>
        </div>

        <div className="profile-content-grid">
          <section className="profile-details-card" aria-labelledby="profile-details-title">
            <div className="profile-card-heading">
              <span className="profile-avatar" aria-hidden="true">
                {customer?.name?.trim().charAt(0).toUpperCase() || "B"}
              </span>
              <div>
                <h2 id="profile-details-title">Personal details</h2>
                <p>Your saved account and delivery information</p>
              </div>
            </div>

            {customer ? (
              <>
                <dl className="profile-details-list">
                  <div>
                    <dt>Full name</dt>
                    <dd>{customer.name}</dd>
                  </div>
                  <div>
                    <dt>Mobile number</dt>
                    <dd>{customer.phone}</dd>
                  </div>
                </dl>

                <div className="profile-address">
                  <h3>Delivery address</h3>
                  {customer.address ? (
                    <address>
                      <strong>{customer.name}</strong>
                      <span>{customer.address.addressLine1}</span>
                      <span>
                        {customer.address.city}, {customer.address.state}
                      </span>
                      <span>PIN {customer.address.pincode}</span>
                    </address>
                  ) : (
                    <p>No delivery address has been saved yet.</p>
                  )}
                </div>
              </>
            ) : (
              <p role="alert">Sign in to view your account details.</p>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
