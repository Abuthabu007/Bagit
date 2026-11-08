import { useEffect, useState } from "react";
import Storefront from "./Storefront.jsx";
import "./App.css";

async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error ?? `Request failed with status ${response.status}`);
  }

  return result;
}

function App() {
  const [view, setView] = useState("landing");
  const [authLoading, setAuthLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [simulatedOtp, setSimulatedOtp] = useState("");
  const [loginMode, setLoginMode] = useState("password");
  const [loginPassword, setLoginPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profile, setProfile] = useState({
    name: "",
    addressLine1: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [serviceability, setServiceability] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function restoreSession() {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const result = await response.json();
          setCustomer(result.customer);
          setView(result.needsPasswordSetup ? "password-setup" : "store");
        } else if (response.status !== 401) {
          throw new Error(`Session check failed with status ${response.status}`);
        }
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setAuthLoading(false);
      }
    }

    restoreSession();
  }, []);

  async function requestOtp(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const result = await postJson("/api/auth/signup/otp", { phone });
      setChallengeId(result.challengeId);
      setSimulatedOtp(result.simulatedOtp);
      setView("verify");
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await postJson("/api/auth/signup/verify", { challengeId, code: otp });
      setView("profile");
      setNotice("Mobile number verified. Add your delivery details to finish signup.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function checkServiceability() {
    setBusy(true);
    setError("");
    setServiceability(null);

    try {
      const response = await fetch(
        `/api/delivery/serviceability/${encodeURIComponent(profile.pincode)}`,
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? `Request failed with status ${response.status}`);
      }
      setServiceability(result);
      if (!result.serviceable) {
        setError(result.message);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function completeSignup(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const result = await postJson("/api/auth/signup/complete", {
        challengeId,
        ...profile,
      });
      setCustomer(result.customer);
      setNotice("Your Bagit account has been created.");
      setView("success");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function loginWithPassword(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const result = await postJson("/api/auth/login/password", {
        phone,
        password: loginPassword,
      });
      setCustomer(result.customer);
      setLoginPassword("");
      setView("store");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function requestLoginOtp(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const result = await postJson("/api/auth/login/otp", { phone });
      setChallengeId(result.challengeId);
      setSimulatedOtp(result.simulatedOtp);
      setOtp("");
      setView("login-otp");
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyLoginOtp(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const result = await postJson("/api/auth/login/otp/verify", {
        challengeId,
        code: otp,
      });
      setCustomer(result.customer);
      setOtp("");
      setSimulatedOtp("");
      setView(result.needsPasswordSetup ? "password-setup" : "store");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveFirstPassword(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const result = await postJson("/api/auth/password/setup", {
        password: newPassword,
      });
      setCustomer(result.customer);
      setNewPassword("");
      setView("store");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function skipPasswordSetup() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/password/setup/skip", {
        method: "POST",
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? `Request failed with status ${response.status}`);
      }
      setView("store");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error(`Logout failed with status ${response.status}`);
      }
      setCustomer(null);
      setView("landing");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function updateProfile(event) {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
    if (name === "pincode") {
      setServiceability(null);
    }
  }

  if (authLoading) {
    return <main className="auth-page"><p role="status">Checking your Bagit session...</p></main>;
  }

  if (view === "store") {
    return (
      <Storefront
        customer={customer}
        onBack={() => setView("landing")}
        onLogout={logout}
      />
    );
  }

  return (
    <main className="auth-page">
      <header className="brand-header" aria-label="Bagit">
        <span className="brand-mark" aria-hidden="true">B</span>
        <span className="brand-name">Bag<span>it</span></span>
      </header>

      {view === "landing" && (
        <section className="auth-card landing-card">
          <p className="eyebrow">WELCOME TO BAGIT</p>
          <h1>Don’t think twice,<br />just bag it.</h1>
          <p className="auth-copy">
            Everyday finds, delivered to your doorstep.
          </p>
          {customer ? (
            <>
              <p className="auth-copy">You’re signed in as {customer.name}.</p>
              <button className="primary-button" onClick={() => setView("store")}>
                Continue shopping
              </button>
              <button className="text-button" onClick={logout}>Sign out</button>
            </>
          ) : (
            <>
              <button className="primary-button" onClick={() => {
                setError("");
                setView("phone");
              }}>
                Create an account
              </button>
              <p className="small-copy">Already have a Bagit account?</p>
              <button className="secondary-button" onClick={() => {
                setError("");
                setLoginMode("password");
                setView("login");
              }}>
                Login
              </button>
            </>
          )}
          <button className="text-button" onClick={() => setView("store")}>
            Preview the current catalogue demo
          </button>
        </section>
      )}

      {view === "phone" && (
        <section className="auth-card">
          <button className="text-button back-button" onClick={() => setView("landing")}>
            ← Back
          </button>
          <p className="eyebrow">CREATE YOUR ACCOUNT · 1 OF 3</p>
          <h1>Start with your mobile</h1>
          <p className="auth-copy">
            We’ll verify your Indian mobile number before collecting delivery details.
          </p>
          <form className="auth-form" onSubmit={requestOtp}>
            <label htmlFor="phone">Mobile number</label>
            <div className="phone-input">
              <span aria-hidden="true">+91</span>
              <input
                id="phone"
                type="tel"
                autoComplete="tel-national"
                inputMode="numeric"
                placeholder="98765 43210"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            </div>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "Sending..." : "Send verification code"}
            </button>
          </form>
        </section>
      )}

      {view === "verify" && (
        <section className="auth-card">
          <button className="text-button back-button" onClick={() => setView("phone")}>
            ← Change mobile number
          </button>
          <p className="eyebrow">CREATE YOUR ACCOUNT · 2 OF 3</p>
          <h1>Verify your number</h1>
          <p className="auth-copy">Enter the 6-digit code for +91 {phone}.</p>
          {simulatedOtp && (
            <p className="dev-otp">
              Local practice OTP: <strong>{simulatedOtp}</strong>
              <span>This simulated code is for local development only.</span>
            </p>
          )}
          <form className="auth-form" onSubmit={verifyOtp}>
            <label htmlFor="otp">Verification code</label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="6-digit code"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
              required
            />
            <button className="primary-button" type="submit" disabled={busy || otp.length !== 6}>
              {busy ? "Verifying..." : "Verify mobile"}
            </button>
          </form>
        </section>
      )}

      {view === "profile" && (
        <section className="auth-card profile-card">
          <p className="eyebrow">CREATE YOUR ACCOUNT · 3 OF 3</p>
          <h1>Where should we deliver?</h1>
          <p className="auth-copy">
            Add your name and address. PIN-code availability is a local demo check.
          </p>
          <form className="auth-form" onSubmit={completeSignup}>
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              name="name"
              autoComplete="name"
              value={profile.name}
              onChange={updateProfile}
              required
            />

            <label htmlFor="addressLine1">Address</label>
            <input
              id="addressLine1"
              name="addressLine1"
              autoComplete="street-address"
              placeholder="House number, street, area"
              value={profile.addressLine1}
              onChange={updateProfile}
              required
            />

            <div className="address-row">
              <div>
                <label htmlFor="city">City</label>
                <input id="city" name="city" autoComplete="address-level2" value={profile.city} onChange={updateProfile} required />
              </div>
              <div>
                <label htmlFor="state">State</label>
                <input id="state" name="state" autoComplete="address-level1" value={profile.state} onChange={updateProfile} required />
              </div>
            </div>

            <label htmlFor="pincode">PIN code</label>
            <div className="pincode-row">
              <input
                id="pincode"
                name="pincode"
                inputMode="numeric"
                autoComplete="postal-code"
                pattern="[1-9][0-9]{5}"
                maxLength={6}
                placeholder="6-digit PIN code"
                value={profile.pincode}
                onChange={updateProfile}
                required
              />
              <button
                className="secondary-button"
                type="button"
                onClick={checkServiceability}
                disabled={busy || profile.pincode.length !== 6}
              >
                Check
              </button>
            </div>
            {serviceability?.serviceable && (
              <p className="inline-success" role="status">{serviceability.message}</p>
            )}
            <button
              className="primary-button"
              type="submit"
              disabled={busy || !serviceability?.serviceable}
            >
              {busy ? "Creating account..." : "Complete signup"}
            </button>
          </form>
        </section>
      )}

      {view === "success" && customer && (
        <section className="auth-card success-card">
          <div className="success-icon" aria-hidden="true">✓</div>
          <p className="eyebrow">WELCOME TO BAGIT</p>
          <h1>You’re all set, {customer.name}.</h1>
          <p className="auth-copy">
            Your mobile number is verified and your delivery address is saved.
          </p>
          <div className="saved-address">
            <strong>Delivery address</strong>
            <span>{customer.address.addressLine1}</span>
            <span>{customer.address.city}, {customer.address.state} {customer.address.pincode}</span>
          </div>
          <p className="small-copy">Your account is ready. Sign in with an OTP to set your password, or continue using OTP login.</p>
          <button className="primary-button" onClick={() => {
            setPhone(customer.phone.replace(/^\+91/, ""));
            setLoginMode("password");
            setError("");
            setView("login");
          }}>
            Continue to login
          </button>
          <button className="text-button" onClick={() => setView("store")}>
            Preview the current catalogue demo
          </button>
        </section>
      )}

      {view === "login" && (
        <section className="auth-card">
          <button className="text-button back-button" onClick={() => setView("landing")}>
            ← Back to Bagit
          </button>
          <p className="eyebrow">WELCOME BACK</p>
          <h1>Login to Bagit</h1>
          <div className="login-tabs" aria-label="Login method">
            <button
              className={loginMode === "password" ? "login-tab active" : "login-tab"}
              type="button"
              onClick={() => { setLoginMode("password"); setError(""); }}
            >
              Password
            </button>
            <button
              className={loginMode === "otp" ? "login-tab active" : "login-tab"}
              type="button"
              onClick={() => { setLoginMode("otp"); setError(""); }}
            >
              Login with OTP
            </button>
          </div>
          <form
            className="auth-form"
            onSubmit={loginMode === "password" ? loginWithPassword : requestLoginOtp}
          >
            <label htmlFor="login-phone">Mobile number</label>
            <div className="phone-input">
              <span aria-hidden="true">+91</span>
              <input
                id="login-phone"
                type="tel"
                autoComplete="tel-national"
                inputMode="numeric"
                placeholder="98765 43210"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            </div>
            {loginMode === "password" && (
              <>
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  required
                />
              </>
            )}
            <button className="primary-button" type="submit" disabled={busy}>
              {busy
                ? "Please wait..."
                : loginMode === "password"
                  ? "Login"
                  : "Send login OTP"}
            </button>
          </form>
          <button className="text-button" onClick={() => {
            setError("");
            setView("phone");
          }}>
            New to Bagit? Create an account
          </button>
        </section>
      )}

      {view === "login-otp" && (
        <section className="auth-card">
          <button className="text-button back-button" onClick={() => setView("login")}>
            ← Back to login
          </button>
          <p className="eyebrow">OTP LOGIN</p>
          <h1>Verify it’s you</h1>
          <p className="auth-copy">Enter the 6-digit code for +91 {phone}.</p>
          {simulatedOtp && (
            <p className="dev-otp">
              Local practice OTP: <strong>{simulatedOtp}</strong>
              <span>This simulated code is for local development only.</span>
            </p>
          )}
          <form className="auth-form" onSubmit={verifyLoginOtp}>
            <label htmlFor="login-otp">Verification code</label>
            <input
              id="login-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
              required
            />
            <button className="primary-button" type="submit" disabled={busy || otp.length !== 6}>
              {busy ? "Verifying..." : "Verify and login"}
            </button>
          </form>
        </section>
      )}

      {view === "password-setup" && (
        <section className="auth-card">
          <p className="eyebrow">SECURE YOUR ACCOUNT</p>
          <h1>Create a password</h1>
          <p className="auth-copy">
            Your mobile is verified. Set a password now, or sign out and continue using OTP login.
          </p>
          <form className="auth-form" onSubmit={saveFirstPassword}>
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            <p className="small-copy">Use at least 12 characters. Passwords are stored as a secure hash.</p>
            <button className="primary-button" type="submit" disabled={busy || newPassword.length < 12}>
              {busy ? "Saving..." : "Save password and continue"}
            </button>
          </form>
          <button className="text-button" onClick={skipPasswordSetup} disabled={busy}>
            {busy ? "Please wait..." : "Continue without setting a password"}
          </button>
        </section>
      )}

      {error && <p className="form-message error-message" role="alert">{error}</p>}
      {notice && view !== "landing" && view !== "success" && (
        <p className="form-message" role="status">{notice}</p>
      )}
      <footer className="auth-footer">A local learning experience by Bagit</footer>
    </main>
  );
}

export default App;
