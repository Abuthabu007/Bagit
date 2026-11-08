import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { pool } from "../db/pool.js";

const scrypt = promisify(scryptCallback);
const otpLifetimeSeconds = 5 * 60;
const maxOtpAttempts = 5;
const maxOtpRequestsPerHour = 3;
const sessionLifetimeDays = 7;
const serviceablePincodes = new Set([
  "110001",
  "110016",
  "400001",
  "400051",
  "411001",
  "500001",
  "560001",
  "560034",
  "600001",
  "600062",
  "700001",
]);

function normalizeIndianPhone(phone) {
  if (typeof phone !== "string") {
    return undefined;
  }

  const digits = phone.replace(/[\s()-]/g, "").replace(/^\+/, "");
  const mobile = digits.startsWith("91") && digits.length === 12
    ? digits.slice(2)
    : digits;

  return /^[6-9]\d{9}$/.test(mobile) ? `+91${mobile}` : undefined;
}

function hashOtp(challengeId, code) {
  return createHash("sha256").update(`${challengeId}:${code}`).digest("hex");
}

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, saltHex, keyHex] = storedHash.split("$");
  if (algorithm !== "scrypt" || !saltHex || !keyHex) {
    throw new Error("Stored password hash has an unsupported format");
  }

  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 12 && password.length <= 128;
}

function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

async function getCustomerProfile(queryable, customerId) {
  const result = await queryable.query(
    `SELECT c.id, c.phone_e164, c.name,
            a.address_line1, a.city, a.state, a.pincode
     FROM customers c
     LEFT JOIN LATERAL (
       SELECT address_line1, city, state, pincode
       FROM customer_addresses
       WHERE customer_id = c.id
       ORDER BY is_default DESC, created_at DESC
       LIMIT 1
     ) a ON true
     WHERE c.id = $1`,
    [customerId],
  );
  const row = result.rows[0];
  if (!row) {
    return undefined;
  }

  return {
    id: row.id,
    phone: row.phone_e164,
    name: row.name,
    address: row.address_line1
      ? {
          addressLine1: row.address_line1,
          city: row.city,
          state: row.state,
          pincode: row.pincode.trim(),
        }
      : null,
  };
}

async function insertCustomerSession(queryable, customerId, passwordSetupAllowed = false) {
  const token = createSessionToken();
  await queryable.query(
    `INSERT INTO customer_sessions (
       id, customer_id, token_hash, password_setup_allowed, expires_at
     )
     VALUES ($1, $2, $3, $4, now() + interval '7 days')`,
    [randomUUID(), customerId, hashSessionToken(token), passwordSetupAllowed],
  );
  return token;
}

function isMatchingHash(expectedHash, candidateHash) {
  const expected = Buffer.from(expectedHash, "hex");
  const candidate = Buffer.from(candidateHash, "hex");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

export function checkMockServiceability(pincode) {
  if (typeof pincode !== "string" || !/^[1-9]\d{5}$/.test(pincode)) {
    return { status: 400, error: "Enter a valid 6-digit Indian PIN code" };
  }

  const serviceable = serviceablePincodes.has(pincode);
  return {
    status: 200,
    serviceable,
    message: serviceable
      ? "Delivery is available in this demo PIN code"
      : "Delivery is not available in this demo PIN code yet",
  };
}

export async function requestSignupOtp(phoneInput) {
  if (process.env.NODE_ENV === "production") {
    return {
      status: 503,
      error: "OTP delivery is not configured for production",
    };
  }

  const phone = normalizeIndianPhone(phoneInput);
  if (!phone) {
    return {
      status: 400,
      error: "Enter a valid 10-digit Indian mobile number",
    };
  }

  const customerResult = await pool.query(
    "SELECT 1 FROM customers WHERE phone_e164 = $1",
    [phone],
  );
  if (customerResult.rowCount > 0) {
    return { status: 409, error: "An account with this mobile number already exists" };
  }

  const rateResult = await pool.query(
    `SELECT count(*)::int AS request_count
     FROM otp_challenges
     WHERE phone_e164 = $1
       AND purpose = 'signup'
       AND created_at > now() - interval '1 hour'`,
    [phone],
  );
  if (rateResult.rows[0].request_count >= maxOtpRequestsPerHour) {
    return { status: 429, error: "Too many OTP requests. Try again later" };
  }

  const challengeId = randomUUID();
  const code = String(randomInt(100000, 1000000));
  await pool.query(
    `INSERT INTO otp_challenges (id, phone_e164, purpose, code_hash, expires_at)
     VALUES ($1, $2, 'signup', $3, now() + interval '5 minutes')`,
    [challengeId, phone, hashOtp(challengeId, code)],
  );

  return {
    status: 201,
    challengeId,
    expiresInSeconds: otpLifetimeSeconds,
    simulatedOtp: code,
    message: "Local development OTP generated; no SMS was sent",
  };
}

export async function verifySignupOtp(challengeId, code) {
  if (
    typeof challengeId !== "string" ||
    typeof code !== "string" ||
    !/^\d{6}$/.test(code)
  ) {
    return { status: 400, error: "Enter the 6-digit OTP" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const challengeResult = await client.query(
      `SELECT id, code_hash, expires_at, attempts, verified_at, consumed_at
       FROM otp_challenges
       WHERE id = $1 AND purpose = 'signup'
       FOR UPDATE`,
      [challengeId],
    );
    const challenge = challengeResult.rows[0];

    if (!challenge || challenge.consumed_at || challenge.expires_at <= new Date()) {
      await client.query("ROLLBACK");
      return { status: 400, error: "OTP is invalid or expired. Request a new one" };
    }

    if (challenge.verified_at) {
      await client.query("COMMIT");
      return { status: 200, verified: true };
    }

    if (challenge.attempts >= maxOtpAttempts) {
      await client.query("ROLLBACK");
      return { status: 429, error: "Too many incorrect attempts. Request a new OTP" };
    }

    if (!isMatchingHash(challenge.code_hash, hashOtp(challengeId, code))) {
      await client.query(
        "UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1",
        [challengeId],
      );
      await client.query("COMMIT");
      return { status: 400, error: "Incorrect OTP" };
    }

    await client.query(
      "UPDATE otp_challenges SET verified_at = now() WHERE id = $1",
      [challengeId],
    );
    await client.query("COMMIT");
    return { status: 200, verified: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function requestLoginOtp(phoneInput) {
  if (process.env.NODE_ENV === "production") {
    return { status: 503, error: "OTP delivery is not configured for production" };
  }

  const phone = normalizeIndianPhone(phoneInput);
  if (!phone) {
    return { status: 400, error: "Enter a valid 10-digit Indian mobile number" };
  }

  const rateResult = await pool.query(
    `SELECT count(*)::int AS request_count
     FROM otp_challenges
     WHERE phone_e164 = $1
       AND purpose = 'login'
       AND created_at > now() - interval '1 hour'`,
    [phone],
  );
  if (rateResult.rows[0].request_count >= maxOtpRequestsPerHour) {
    return { status: 429, error: "Too many OTP requests. Try again later" };
  }

  const challengeId = randomUUID();
  const code = String(randomInt(100000, 1000000));
  await pool.query(
    `INSERT INTO otp_challenges (id, phone_e164, purpose, code_hash, expires_at)
     VALUES ($1, $2, 'login', $3, now() + interval '5 minutes')`,
    [challengeId, phone, hashOtp(challengeId, code)],
  );

  return {
    status: 201,
    challengeId,
    expiresInSeconds: otpLifetimeSeconds,
    simulatedOtp: code,
    message: "Local development OTP generated; no SMS was sent",
  };
}

export async function verifyLoginOtp(challengeId, code) {
  if (
    typeof challengeId !== "string" ||
    typeof code !== "string" ||
    !/^\d{6}$/.test(code)
  ) {
    return { status: 400, error: "Enter the 6-digit OTP" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const challengeResult = await client.query(
      `SELECT phone_e164, code_hash, expires_at, attempts, consumed_at
       FROM otp_challenges
       WHERE id = $1 AND purpose = 'login'
       FOR UPDATE`,
      [challengeId],
    );
    const challenge = challengeResult.rows[0];

    if (
      !challenge ||
      challenge.consumed_at ||
      challenge.expires_at <= new Date() ||
      challenge.attempts >= maxOtpAttempts ||
      !isMatchingHash(challenge.code_hash, hashOtp(challengeId, code))
    ) {
      if (challenge && !challenge.consumed_at && challenge.attempts < maxOtpAttempts) {
        await client.query(
          "UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1",
          [challengeId],
        );
        await client.query("COMMIT");
      } else {
        await client.query("ROLLBACK");
      }
      return { status: 401, error: "OTP is invalid, expired, or the account was not found" };
    }

    const customerResult = await client.query(
      "SELECT id, password_hash FROM customers WHERE phone_e164 = $1",
      [challenge.phone_e164],
    );
    const customer = customerResult.rows[0];
    if (!customer) {
      await client.query("ROLLBACK");
      return { status: 401, error: "OTP is invalid, expired, or the account was not found" };
    }

    const sessionToken = await insertCustomerSession(
      client,
      customer.id,
      customer.password_hash === null,
    );
    await client.query(
      "UPDATE otp_challenges SET consumed_at = now(), verified_at = now() WHERE id = $1",
      [challengeId],
    );
    const profile = await getCustomerProfile(client, customer.id);
    await client.query("COMMIT");

    return {
      status: 200,
      sessionToken,
      needsPasswordSetup: customer.password_hash === null,
      customer: profile,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function loginWithPassword(phoneInput, password) {
  const phone = normalizeIndianPhone(phoneInput);
  if (!phone || typeof password !== "string" || password.length > 128) {
    return { status: 401, error: "Mobile number or password is incorrect" };
  }

  const customerResult = await pool.query(
    "SELECT id, password_hash FROM customers WHERE phone_e164 = $1",
    [phone],
  );
  const customer = customerResult.rows[0];
  if (!customer?.password_hash || !(await verifyPassword(password, customer.password_hash))) {
    return { status: 401, error: "Mobile number or password is incorrect" };
  }

  const sessionToken = await insertCustomerSession(pool, customer.id);
  return {
    status: 200,
    sessionToken,
    customer: await getCustomerProfile(pool, customer.id),
  };
}

export async function setFirstPassword(sessionToken, password) {
  if (!isValidPassword(password)) {
    return { status: 400, error: "Password must be between 12 and 128 characters" };
  }
  if (typeof sessionToken !== "string" || sessionToken.length < 32) {
    return { status: 401, error: "Sign in with OTP before setting a password" };
  }

  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `UPDATE customers c
     SET password_hash = $1
     FROM customer_sessions s
     WHERE s.token_hash = $2
       AND s.customer_id = c.id
       AND s.expires_at > now()
       AND s.password_setup_allowed = true
       AND c.password_hash IS NULL
     RETURNING c.id`,
    [passwordHash, hashSessionToken(sessionToken)],
  );
  if (result.rowCount !== 1) {
    return { status: 409, error: "Password setup is not available for this session" };
  }

  await pool.query(
    `UPDATE customer_sessions
     SET password_setup_allowed = false
     WHERE token_hash = $1`,
    [hashSessionToken(sessionToken)],
  );
  return {
    status: 200,
    customer: await getCustomerProfile(pool, result.rows[0].id),
  };
}

export async function skipFirstPassword(sessionToken) {
  if (typeof sessionToken !== "string" || sessionToken.length < 32) {
    return { status: 401, error: "Sign in with OTP before continuing" };
  }
  const result = await pool.query(
    `UPDATE customer_sessions
     SET password_setup_allowed = false
     WHERE token_hash = $1 AND expires_at > now()
       AND password_setup_allowed = true`,
    [hashSessionToken(sessionToken)],
  );
  if (result.rowCount !== 1) {
    return { status: 409, error: "Password setup is not available for this session" };
  }
  return { status: 204 };
}

export async function getSessionCustomer(sessionToken) {
  if (typeof sessionToken !== "string" || sessionToken.length < 32) {
    return undefined;
  }
  const result = await pool.query(
    `SELECT c.id, s.password_setup_allowed
     FROM customer_sessions s
     JOIN customers c ON c.id = s.customer_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashSessionToken(sessionToken)],
  );
  if (!result.rows[0]) {
    return undefined;
  }

  return {
    customer: await getCustomerProfile(pool, result.rows[0].id),
    needsPasswordSetup: result.rows[0].password_setup_allowed,
  };
}

export async function destroySession(sessionToken) {
  if (typeof sessionToken !== "string" || sessionToken.length < 32) {
    return;
  }
  await pool.query(
    "DELETE FROM customer_sessions WHERE token_hash = $1",
    [hashSessionToken(sessionToken)],
  );
}

export async function completeSignup(input = {}) {
  const { challengeId, name, addressLine1, city, state, pincode } = input;

  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
    return { status: 400, error: "Name must be between 2 and 100 characters" };
  }
  if (
    typeof addressLine1 !== "string" ||
    addressLine1.trim().length < 5 ||
    addressLine1.trim().length > 200
  ) {
    return { status: 400, error: "Address must be between 5 and 200 characters" };
  }
  if (typeof city !== "string" || city.trim().length < 2 || city.trim().length > 100) {
    return { status: 400, error: "Enter a valid city" };
  }
  if (typeof state !== "string" || state.trim().length < 2 || state.trim().length > 100) {
    return { status: 400, error: "Enter a valid state" };
  }

  const serviceability = checkMockServiceability(pincode);
  if (serviceability.status !== 200 || !serviceability.serviceable) {
    return {
      status: serviceability.status === 200 ? 422 : serviceability.status,
      error: serviceability.status === 200
        ? serviceability.message
        : serviceability.error,
    };
  }
  if (typeof challengeId !== "string") {
    return { status: 400, error: "Verify your mobile number before continuing" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const challengeResult = await client.query(
      `SELECT phone_e164, expires_at, verified_at, consumed_at
       FROM otp_challenges
       WHERE id = $1 AND purpose = 'signup'
       FOR UPDATE`,
      [challengeId],
    );
    const challenge = challengeResult.rows[0];
    if (
      !challenge ||
      !challenge.verified_at ||
      challenge.consumed_at ||
      challenge.expires_at <= new Date()
    ) {
      await client.query("ROLLBACK");
      return { status: 400, error: "Verify your mobile number again before signing up" };
    }

    const customerId = randomUUID();
    const addressId = randomUUID();
    await client.query(
      `INSERT INTO customers (id, phone_e164, phone_verified_at, name)
       VALUES ($1, $2, $3, $4)`,
      [customerId, challenge.phone_e164, challenge.verified_at, name.trim()],
    );
    await client.query(
      `INSERT INTO customer_addresses (
         id, customer_id, address_line1, city, state, pincode
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        addressId,
        customerId,
        addressLine1.trim(),
        city.trim(),
        state.trim(),
        pincode,
      ],
    );
    await client.query(
      "UPDATE otp_challenges SET consumed_at = now() WHERE id = $1",
      [challengeId],
    );
    await client.query("COMMIT");

    return {
      status: 201,
      customer: {
        id: customerId,
        phone: challenge.phone_e164,
        name: name.trim(),
        address: {
          id: addressId,
          addressLine1: addressLine1.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode,
        },
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return { status: 409, error: "An account with this mobile number already exists" };
    }
    throw error;
  } finally {
    client.release();
  }
}
