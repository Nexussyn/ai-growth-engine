-- Migration: Referral system (Issue #2)
-- Idempotent: safe to re-run

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
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

CREATE TABLE IF NOT EXISTS user_credit_balances (
  user_id TEXT PRIMARY KEY,
  free_credits INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_owner
  ON referral_codes (owner_id);

CREATE INDEX IF NOT EXISTS idx_referral_conversions_user
  ON referral_conversions (new_user_id);

CREATE OR REPLACE FUNCTION process_referral(p_code TEXT, p_new_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_owner_id TEXT;
  v_credits INT := 5;
  v_norm TEXT;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' OR p_new_user_id IS NULL OR btrim(p_new_user_id) = '' THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  v_norm := upper(btrim(p_code));

  -- Idempotency check
  IF EXISTS (
    SELECT 1 FROM referral_conversions
    WHERE referral_code = v_norm AND new_user_id = p_new_user_id
  ) THEN
    RETURN jsonb_build_object('status', 'already_processed');
  END IF;

  SELECT owner_id INTO v_owner_id FROM referral_codes WHERE code = v_norm;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_code');
  END IF;

  IF v_owner_id = p_new_user_id THEN
    RETURN jsonb_build_object('status', 'self_referral');
  END IF;

  -- Log conversion
  INSERT INTO referral_conversions (referral_code, new_user_id)
  VALUES (v_norm, p_new_user_id);

  -- Award credits on code + owner balance
  UPDATE referral_codes
  SET uses = uses + 1,
      credits_awarded = credits_awarded + v_credits
  WHERE code = v_norm;

  INSERT INTO user_credit_balances (user_id, free_credits, updated_at)
  VALUES (v_owner_id, v_credits, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET free_credits = user_credit_balances.free_credits + EXCLUDED.free_credits,
        updated_at = NOW();

  -- Log event
  INSERT INTO system_events (event_type, payload, created_at)
  VALUES (
    'referral_conversion',
    jsonb_build_object(
      'code', v_norm,
      'new_user', p_new_user_id,
      'owner_id', v_owner_id,
      'credits', v_credits
    ),
    NOW()
  );

  -- Notify both users
  INSERT INTO user_notifications (user_id, message)
  VALUES
    (v_owner_id, format('Referral success: +%s free credits (code %s).', v_credits, v_norm)),
    (p_new_user_id, format('Welcome — you joined via referral %s.', v_norm));

  RETURN jsonb_build_object(
    'status', 'ok',
    'credits_awarded', v_credits,
    'owner_id', v_owner_id
  );
END;
$$ LANGUAGE plpgsql;
