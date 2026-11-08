CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY,
  phone_e164 text NOT NULL UNIQUE,
  phone_verified_at timestamptz NOT NULL,
  name text NOT NULL,
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id),
  address_line1 text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  pincode char(6) NOT NULL CHECK (pincode ~ '^[1-9][0-9]{5}$'),
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id uuid PRIMARY KEY,
  phone_e164 text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('signup')),
  code_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  verified_at timestamptz,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS otp_challenges_phone_created_idx
  ON otp_challenges (phone_e164, created_at DESC);
