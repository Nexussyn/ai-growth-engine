-- Idempotent referral conversion schema (Issue #2)
CREATE TABLE IF NOT EXISTS referral_codes (
  code TEXT PRIMARY KEY,
  owner_id UUID NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0),
  credits_awarded INTEGER NOT NULL DEFAULT 0 CHECK (credits_awarded >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_conversions (
  referral_code TEXT NOT NULL REFERENCES referral_codes(code),
  new_user_id UUID NOT NULL,
  referrer_id UUID NOT NULL,
  credits_awarded INTEGER NOT NULL DEFAULT 5 CHECK (credits_awarded = 5),
  converted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (referral_code, new_user_id)
);

CREATE INDEX IF NOT EXISTS referral_conversions_referrer_idx
  ON referral_conversions (referrer_id);
