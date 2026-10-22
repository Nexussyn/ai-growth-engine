-- Migration: Referral system (Issue #2)
-- Idempotent

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
  UNIQUE(referral_code, new_user_id),
  UNIQUE(new_user_id)
);

CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION process_referral(p_code TEXT, p_new_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_owner_id TEXT;
  v_credits INT := 5;
  v_total_credits INT;
  v_inserted INT;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' OR p_new_user_id IS NULL OR btrim(p_new_user_id) = '' THEN
    RETURN jsonb_build_object('status', 'invalid_input', 'credits_awarded', 0);
  END IF;

  SELECT owner_id INTO v_owner_id FROM referral_codes WHERE code = p_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_code', 'credits_awarded', 0);
  END IF;

  IF v_owner_id = p_new_user_id THEN
    RETURN jsonb_build_object('status', 'self_referral', 'credits_awarded', 0);
  END IF;

  INSERT INTO referral_conversions (referral_code, new_user_id)
  VALUES (p_code, p_new_user_id)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN jsonb_build_object('status', 'already_processed', 'credits_awarded', 0);
  END IF;

  UPDATE referral_codes
  SET uses = uses + 1,
      credits_awarded = credits_awarded + v_credits
  WHERE code = p_code
  RETURNING credits_awarded INTO v_total_credits;

  INSERT INTO system_events (event_type, payload, created_at)
  VALUES (
    'referral_conversion',
    jsonb_build_object(
      'code', p_code,
      'referrer_id', v_owner_id,
      'new_user', p_new_user_id,
      'credits', v_credits,
      'total_referrer_credits', v_total_credits
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'credits_awarded', v_credits,
    'owner_id', v_owner_id,
    'referrer_balance', v_total_credits,
    'notifications', jsonb_build_object(
      'referrer', format('You earned %s free credits for referring user %s!', v_credits, p_new_user_id),
      'referee', format('Your referral code %s was applied! %s earned %s free credits.', p_code, v_owner_id, v_credits)
    )
  );
END;
$$ LANGUAGE plpgsql;
