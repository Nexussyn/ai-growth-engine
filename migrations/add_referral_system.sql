-- Migration: Referral system (Issue #2)
-- Idempotent: safe to run multiple times

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL DEFAULT substring(gen_random_uuid()::text, 1, 8),
  owner_id TEXT NOT NULL,
  uses INT NOT NULL DEFAULT 0,
  credits_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code TEXT NOT NULL REFERENCES referral_codes(code),
  new_user_id TEXT NOT NULL,
  converted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referral_code, new_user_id)
);

CREATE TABLE IF NOT EXISTS user_credits (
  user_id TEXT PRIMARY KEY,
  balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION process_referral(p_code TEXT, p_new_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_owner_id TEXT;
  v_credits INT := 5;
  v_referrer_balance INT;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' OR p_new_user_id IS NULL OR btrim(p_new_user_id) = '' THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  SELECT owner_id INTO v_owner_id FROM referral_codes WHERE code = p_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_code');
  END IF;

  IF v_owner_id = p_new_user_id THEN
    RETURN jsonb_build_object('status', 'self_referral');
  END IF;

  -- Atomic idempotency guard against duplicate redemption by the same user
  INSERT INTO referral_conversions (referral_code, new_user_id)
  VALUES (p_code, p_new_user_id)
  ON CONFLICT (referral_code, new_user_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'already_processed');
  END IF;

  -- Update referral code counters
  UPDATE referral_codes
  SET uses = uses + 1,
      credits_awarded = credits_awarded + v_credits
  WHERE code = p_code;

  -- Credit referrer balance
  INSERT INTO user_credits (user_id, balance, updated_at)
  VALUES (v_owner_id, v_credits, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = user_credits.balance + EXCLUDED.balance,
        updated_at = NOW()
  RETURNING balance INTO v_referrer_balance;

  -- Log conversion event
  INSERT INTO system_events (event_type, payload, created_at)
  VALUES (
    'referral_conversion',
    jsonb_build_object(
      'code', p_code,
      'referrer_id', v_owner_id,
      'new_user', p_new_user_id,
      'credits', v_credits
    ),
    NOW()
  );

  -- Notify both referrer and referred user
  INSERT INTO user_notifications (user_id, notification_type, message, created_at)
  VALUES
    (
      v_owner_id,
      'referral_reward',
      format('Your referral converted: +%s free credits added to your balance.', v_credits),
      NOW()
    ),
    (
      p_new_user_id,
      'referral_welcome',
      format('Referral applied! Your referrer received %s free credits after your first paid call.', v_credits),
      NOW()
    );

  RETURN jsonb_build_object(
    'status', 'ok',
    'credits_awarded', v_credits,
    'owner_id', v_owner_id,
    'referrer_balance', v_referrer_balance
  );
END;
$$ LANGUAGE plpgsql;
