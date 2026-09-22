-- Migration: Referral system (Issue #2)
-- Idempotent

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL DEFAULT substring(gen_random_uuid()::text, 1, 8),
  owner_id TEXT NOT NULL,
  uses INT DEFAULT 0,
  credits_awarded INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code TEXT NOT NULL REFERENCES referral_codes(code),
  new_user_id TEXT NOT NULL,
  converted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referral_code, new_user_id)
);

-- Written ONLY by the trusted billing worker after a settled first paid call.
-- This is evidence of qualification, not a client-supplied boolean.
CREATE TABLE IF NOT EXISTS referral_paid_users (
  user_id TEXT PRIMARY KEY,
  first_payment_id TEXT UNIQUE NOT NULL,
  qualified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Module-owned credit balance and durable notification outbox. Integration
-- workers consume these; neither schema is assumed to exist in the host app.
CREATE TABLE IF NOT EXISTS referral_credit_balances (
  user_id TEXT PRIMARY KEY,
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0)
);
CREATE TABLE IF NOT EXISTS referral_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  conversion_id UUID NOT NULL REFERENCES referral_conversions(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, conversion_id)
);
CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One first-paid conversion per user, even across different referral codes.
-- Existing cross-code duplicates must be reconciled before this upgrade.
CREATE UNIQUE INDEX IF NOT EXISTS referral_one_conversion_per_user
ON referral_conversions(new_user_id);

CREATE OR REPLACE FUNCTION process_referral(p_code TEXT, p_new_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_owner_id TEXT;
  v_credits INT := 5;
  v_conversion_id UUID;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' OR p_new_user_id IS NULL OR btrim(p_new_user_id) = '' THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  SELECT owner_id INTO v_owner_id FROM referral_codes WHERE code = p_code;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'invalid_code'); END IF;
  IF v_owner_id = p_new_user_id THEN
    RETURN jsonb_build_object('status', 'self_referral');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM referral_paid_users WHERE user_id = p_new_user_id) THEN
    RETURN jsonb_build_object('status', 'not_qualified');
  END IF;

  INSERT INTO referral_conversions (referral_code, new_user_id)
  VALUES (p_code, p_new_user_id)
  ON CONFLICT DO NOTHING RETURNING id INTO v_conversion_id;
  IF v_conversion_id IS NULL THEN
    RETURN jsonb_build_object('status', 'already_processed');
  END IF;

  -- All writes commit together, including the two durable notifications.
  INSERT INTO referral_credit_balances(user_id,balance) VALUES (v_owner_id,v_credits)
  ON CONFLICT(user_id) DO UPDATE
    SET balance = referral_credit_balances.balance + EXCLUDED.balance;
  UPDATE referral_codes SET uses = COALESCE(uses,0) + 1,
    credits_awarded = COALESCE(credits_awarded,0) + v_credits WHERE code = p_code;

  -- Log event
  INSERT INTO system_events (event_type, payload, created_at)
  VALUES ('referral_conversion', jsonb_build_object('code', p_code, 'new_user', p_new_user_id,
    'owner_id', v_owner_id, 'conversion_id', v_conversion_id, 'credits', v_credits), NOW());

  INSERT INTO referral_notifications(user_id,conversion_id,message) VALUES
    (v_owner_id,v_conversion_id,'Your referral converted. You received 5 free credits.'),
    (p_new_user_id,v_conversion_id,'Your first paid call rewarded your referrer with 5 free credits.');

  RETURN jsonb_build_object('status', 'ok', 'credits_awarded', v_credits, 'owner_id', v_owner_id);
END;
$$ LANGUAGE plpgsql;

-- A backend service must be granted table/function access explicitly. Never
-- expose qualification writes or this RPC to unauthenticated browser clients.
REVOKE ALL ON FUNCTION process_referral(TEXT,TEXT) FROM PUBLIC;
