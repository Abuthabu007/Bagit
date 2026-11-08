ALTER TABLE otp_challenges
  DROP CONSTRAINT IF EXISTS otp_challenges_purpose_check;

ALTER TABLE otp_challenges
  ADD CONSTRAINT otp_challenges_purpose_check
  CHECK (purpose IN ('signup', 'login'));

CREATE TABLE IF NOT EXISTS customer_sessions (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  password_setup_allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS customer_sessions_customer_idx
  ON customer_sessions (customer_id);
