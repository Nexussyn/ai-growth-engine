-- Migration: Referral system (Issue #2)
-- Idempotent and safe to apply repeatedly.

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL DEFAULT substring(gen_random_uuid()::text, 1, 8),
  owner_id TEXT NOT NULL,
  uses INT NOT NULL DEFAULT 0 CHECK (uses >= 0),
  credits_awarded INT NOT NULL DEFAULT 0 CHECK (credits_awarded >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code TEXT NOT NULL REFERENCES referral_codes(code),
  new_user_id TEXT NOT NULL,
  converted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referral_code, new_user_id)
);
CREATE TABLE IF NOT EXISTS user_credits (
  user_id TEXT PRIMARY KEY,
  free_credits INT NOT NULL DEFAULT 0 CHECK (free_credits >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  referral_code TEXT NOT NULL REFERENCES referral_codes(code),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION process_referral(p_code TEXT, p_new_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_owner_id TEXT;
  v_credits INT := 5;
  v_conversion_id UUID;
BEGIN
  IF NULLIF(BTRIM(p_code), '') IS NULL OR NULLIF(BTRIM(p_new_user_id), '') IS NULL THEN
    RAISE EXCEPTION 'referral code and new user id are required';
  END IF;

  SELECT owner_id
    INTO v_owner_id
    FROM referral_codes
   WHERE code = BTRIM(p_code)
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_code');
  END IF;

  IF v_owner_id = BTRIM(p_new_user_id) THEN
    RETURN jsonb_build_object('status', 'self_referral');
  END IF;

  -- The unique constraint makes duplicate paid-call callbacks race-safe.
  INSERT INTO referral_conversions (referral_code, new_user_id)
  VALUES (BTRIM(p_code), BTRIM(p_new_user_id))
  ON CONFLICT (referral_code, new_user_id) DO NOTHING
  RETURNING id INTO v_conversion_id;
  IF v_conversion_id IS NULL THEN
    RETURN jsonb_build_object('status', 'already_processed');
  END IF;

  INSERT INTO user_credits (user_id, free_credits)
  VALUES (v_owner_id, v_credits)
  ON CONFLICT (user_id) DO UPDATE
    SET free_credits = user_credits.free_credits + EXCLUDED.free_credits,
        updated_at = NOW();

  UPDATE referral_codes
     SET uses = uses + 1,
         credits_awarded = credits_awarded + v_credits
   WHERE code = BTRIM(p_code);

  INSERT INTO system_events (event_type, payload, created_at)
  VALUES (
    'referral_conversion',
    jsonb_build_object(
      'code', BTRIM(p_code),
      'owner_id', v_owner_id,
      'new_user_id', BTRIM(p_new_user_id),
      'credits', v_credits
    ),
    NOW()
  );
  INSERT INTO referral_notifications (user_id, kind, message, referral_code)
  VALUES
    (
      v_owner_id,
      'referral_reward',
      'Referral converted: +5 free credits',
      BTRIM(p_code)
    ),
    (
      BTRIM(p_new_user_id),
      'referral_conversion',
      'Your first paid call completed a referral conversion.',
      BTRIM(p_code)
    );

  RETURN jsonb_build_object(
    'status', 'ok',
    'credits_awarded', v_credits,
    'owner_id', v_owner_id
  );
END;
$$ LANGUAGE plpgsql;
