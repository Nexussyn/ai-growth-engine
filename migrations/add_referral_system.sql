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

CREATE TABLE IF NOT EXISTS referral_credit_balances (
  user_id TEXT PRIMARY KEY,
  free_credits INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION process_referral(p_code TEXT, p_new_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_owner_id TEXT;
  v_credits INT := 5;
BEGIN
  -- Idempotency check
  IF EXISTS (SELECT 1 FROM referral_conversions WHERE referral_code = p_code AND new_user_id = p_new_user_id) THEN
    RETURN jsonb_build_object('status', 'already_processed');
  END IF;

  SELECT owner_id INTO v_owner_id FROM referral_codes WHERE code = p_code;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'invalid_code'); END IF;

  -- Log conversion
  INSERT INTO referral_conversions (referral_code, new_user_id) VALUES (p_code, p_new_user_id);

  -- Award credits
  UPDATE referral_codes SET uses = uses + 1, credits_awarded = credits_awarded + v_credits WHERE code = p_code;

  INSERT INTO referral_credit_balances (user_id, free_credits, updated_at)
  VALUES (v_owner_id, v_credits, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    free_credits = referral_credit_balances.free_credits + EXCLUDED.free_credits,
    updated_at = NOW();

  -- Log event
  INSERT INTO system_events (event_type, payload, created_at)
  VALUES ('referral_conversion', jsonb_build_object('code', p_code, 'new_user', p_new_user_id, 'credits', v_credits), NOW());

  INSERT INTO referral_notifications (user_id, notification_type, payload)
  VALUES
    (v_owner_id, 'referral_credit_awarded', jsonb_build_object('code', p_code, 'new_user', p_new_user_id, 'credits', v_credits)),
    (p_new_user_id, 'referral_signup_confirmed', jsonb_build_object('code', p_code, 'referrer', v_owner_id));

  RETURN jsonb_build_object('status', 'ok', 'credits_awarded', v_credits, 'owner_id', v_owner_id);
END;
$$ LANGUAGE plpgsql;
