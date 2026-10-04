-- Migration: Referral system follow-up (Issue #2)
-- Fixes honest gaps in add_referral_system.sql:
--   1. No user_credits/balances table existed — credits were only tallied on the
--      referral_codes row, never added to the referrer's actual balance.
--   2. No system_events table existed (referenced but never created) — the
--      referral_conversion INSERT would fail on a fresh database.
--   3. No self-referral guard — an owner could convert their own code.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS user_credits (
  user_id TEXT PRIMARY KEY,
  balance INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Replace process_referral: now actually credits the referrer's balance,
-- rejects self-referrals, and keeps the idempotency + system_events logging.
CREATE OR REPLACE FUNCTION process_referral(p_code TEXT, p_new_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_owner_id TEXT;
  v_credits INT := 5;
BEGIN
  -- Idempotency: same referral can't be converted twice by the same user.
  IF EXISTS (SELECT 1 FROM referral_conversions
             WHERE referral_code = p_code AND new_user_id = p_new_user_id) THEN
    RETURN jsonb_build_object('status', 'already_processed');
  END IF;

  SELECT owner_id INTO v_owner_id FROM referral_codes WHERE code = p_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_code');
  END IF;

  -- Self-referral guard.
  IF v_owner_id = p_new_user_id THEN
    RETURN jsonb_build_object('status', 'self_referral');
  END IF;

  -- Record the conversion first (unique constraint is the backstop).
  INSERT INTO referral_conversions (referral_code, new_user_id)
  VALUES (p_code, p_new_user_id)
  ON CONFLICT (referral_code, new_user_id) DO NOTHING;

  -- Award 5 credits to the referrer's real balance.
  INSERT INTO user_credits (user_id, balance)
  VALUES (v_owner_id, v_credits)
  ON CONFLICT (user_id)
  DO UPDATE SET balance = user_credits.balance + v_credits,
                updated_at = NOW();

  -- Roll up counters on the code row.
  UPDATE referral_codes
  SET uses = uses + 1,
      credits_awarded = credits_awarded + v_credits
  WHERE code = p_code;

  -- Log the conversion event.
  INSERT INTO system_events (event_type, payload, created_at)
  VALUES ('referral_conversion',
          jsonb_build_object('code', p_code,
                             'owner_id', v_owner_id,
                             'new_user', p_new_user_id,
                             'credits', v_credits),
          NOW());

  RETURN jsonb_build_object('status', 'ok',
                            'credits_awarded', v_credits,
                            'owner_id', v_owner_id);
END;
$$ LANGUAGE plpgsql;
