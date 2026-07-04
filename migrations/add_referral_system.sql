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

-- System events table for audit trail
CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS system_events_event_type_created_at_idx
  ON system_events (event_type, created_at DESC);

CREATE OR REPLACE FUNCTION process_referral(p_code TEXT, p_new_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_owner_id TEXT;
  v_credits INT := 5;
  v_conversion_id UUID;
BEGIN
  -- Look up the code owner
  SELECT owner_id INTO v_owner_id FROM referral_codes WHERE code = p_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_code');
  END IF;

  -- Block self-referral
  IF v_owner_id = p_new_user_id THEN
    RETURN jsonb_build_object('status', 'self_referral_blocked');
  END IF;

  -- Idempotent conversion insert (prevents duplicate processing under concurrent retries)
  INSERT INTO referral_conversions (referral_code, new_user_id)
  VALUES (p_code, p_new_user_id)
  ON CONFLICT (referral_code, new_user_id) DO NOTHING
  RETURNING id INTO v_conversion_id;

  IF v_conversion_id IS NULL THEN
    RETURN jsonb_build_object('status', 'already_processed');
  END IF;

  -- Award credits
  UPDATE referral_codes
  SET uses = uses + 1, credits_awarded = credits_awarded + v_credits
  WHERE code = p_code;

  -- Log event
  INSERT INTO system_events (event_type, user_id, payload, created_at)
  VALUES (
    'referral_conversion',
    v_owner_id,
    jsonb_build_object(
      'code', p_code,
      'new_user', p_new_user_id,
      'credits', v_credits,
      'owner_id', v_owner_id
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'credits_awarded', v_credits,
    'owner_id', v_owner_id
  );
END;
$$ LANGUAGE plpgsql;
