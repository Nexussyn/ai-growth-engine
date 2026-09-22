-- Migration: Qualified referral credits with abuse-resistant guards (Issue #2)
-- Idempotent. Additive: does not drop, rename, or alter the shape of any
-- existing table or column. Depends on migrations/add_referral_system.sql
-- (referral_codes, referral_conversions) already present on main.
--
-- Problem this closes (#2): process_referral() on main awards 5 credits for
-- ANY conversion row, including unpaid signups and self-referrals, and only
-- ever mutates referral_codes' aggregate counters -- there is no per-user
-- balance, no notification, and no record of denied/abusive attempts.
--
-- This migration adds:
--   1. referral_qualifying_payments -- host-owned evidence table. The billing
--      worker inserts one row per user the moment their FIRST payment
--      settles. process_referral() treats a row here as the only trusted
--      "this user is paid" signal; it never infers payment on its own.
--   2. referral_credit_balances -- atomic, per-user credit balance.
--   3. referral_recipients -- one row per user ever successfully referred,
--      regardless of which code was used. A user can only appear once here,
--      which enforces duplicate prevention ACROSS different codes (the
--      existing referral_conversions UNIQUE(code, user) only prevents
--      replaying the SAME code).
--   4. referral_notifications -- durable notification rows for both the
--      referrer and the referred user.
--   5. referral_events -- append-only audit trail of every award AND every
--      denial (unpaid / self-referral / duplicate / invalid code), keyed by
--      an optional idempotency key so a retried RPC call replays its
--      original result instead of re-evaluating (and potentially
--      double-awarding).
--
-- process_referral() is replaced (CREATE OR REPLACE, same first two
-- parameters, new third parameter defaults to NULL) so existing two-argument
-- callers keep working; its behavior now enforces the guards above and
-- returns a typed denial reason instead of silently no-op'ing.

CREATE TABLE IF NOT EXISTS referral_qualifying_payments (
  user_id TEXT PRIMARY KEY,
  first_payment_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT
);
COMMENT ON TABLE referral_qualifying_payments IS
  'Host-owned evidence table. Insert one row per user the first time their payment settles. process_referral() will not award credits for a referred user absent from this table. Never written by process_referral() itself.';

CREATE TABLE IF NOT EXISTS referral_credit_balances (
  user_id TEXT PRIMARY KEY,
  balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_recipients (
  referred_user_id TEXT PRIMARY KEY,
  referral_code TEXT NOT NULL,
  converted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notif_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_referral_notifications_user ON referral_notifications(user_id);

CREATE TABLE IF NOT EXISTS referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE,
  referral_code TEXT NOT NULL,
  new_user_id TEXT NOT NULL,
  status TEXT NOT NULL,          -- 'ok' | 'denied' | 'already_processed'
  reason TEXT,                   -- denial-reason enum; NULL when status = 'ok'
  result JSONB NOT NULL,         -- full RPC reply, replayed verbatim on retry
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_events_pair ON referral_events(referral_code, new_user_id);

CREATE OR REPLACE FUNCTION process_referral(
  p_code TEXT,
  p_new_user_id TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_owner_id TEXT;
  v_credits INT := 5;
  v_result JSONB;
  v_cached JSONB;
BEGIN
  -- Replay: a previously-seen idempotency key returns its stored result
  -- without re-evaluating anything, so a retried call can never double-award.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT result INTO v_cached FROM referral_events WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_cached;
    END IF;
  END IF;

  IF p_code IS NULL OR btrim(p_code) = '' OR p_new_user_id IS NULL OR btrim(p_new_user_id) = '' THEN
    RETURN jsonb_build_object('status', 'denied', 'reason', 'INVALID_INPUT');
  END IF;

  SELECT owner_id INTO v_owner_id FROM referral_codes WHERE code = p_code;
  IF NOT FOUND THEN
    v_result := jsonb_build_object('status', 'denied', 'reason', 'INVALID_CODE');
    INSERT INTO referral_events (idempotency_key, referral_code, new_user_id, status, reason, result)
    VALUES (p_idempotency_key, p_code, p_new_user_id, 'denied', 'INVALID_CODE', v_result)
    ON CONFLICT (idempotency_key) DO NOTHING;
    RETURN v_result;
  END IF;

  IF v_owner_id = p_new_user_id THEN
    v_result := jsonb_build_object('status', 'denied', 'reason', 'SELF_REFERRAL');
    INSERT INTO referral_events (idempotency_key, referral_code, new_user_id, status, reason, result)
    VALUES (p_idempotency_key, p_code, p_new_user_id, 'denied', 'SELF_REFERRAL', v_result)
    ON CONFLICT (idempotency_key) DO NOTHING;
    RETURN v_result;
  END IF;

  IF EXISTS (SELECT 1 FROM referral_conversions WHERE referral_code = p_code AND new_user_id = p_new_user_id) THEN
    v_result := jsonb_build_object('status', 'already_processed', 'reason', 'DUPLICATE_CODE');
    INSERT INTO referral_events (idempotency_key, referral_code, new_user_id, status, reason, result)
    VALUES (p_idempotency_key, p_code, p_new_user_id, 'already_processed', 'DUPLICATE_CODE', v_result)
    ON CONFLICT (idempotency_key) DO NOTHING;
    RETURN v_result;
  END IF;

  IF EXISTS (SELECT 1 FROM referral_recipients WHERE referred_user_id = p_new_user_id) THEN
    v_result := jsonb_build_object('status', 'denied', 'reason', 'DUPLICATE_PAIR');
    INSERT INTO referral_events (idempotency_key, referral_code, new_user_id, status, reason, result)
    VALUES (p_idempotency_key, p_code, p_new_user_id, 'denied', 'DUPLICATE_PAIR', v_result)
    ON CONFLICT (idempotency_key) DO NOTHING;
    RETURN v_result;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM referral_qualifying_payments WHERE user_id = p_new_user_id) THEN
    v_result := jsonb_build_object('status', 'denied', 'reason', 'UNPAID');
    INSERT INTO referral_events (idempotency_key, referral_code, new_user_id, status, reason, result)
    VALUES (p_idempotency_key, p_code, p_new_user_id, 'denied', 'UNPAID', v_result)
    ON CONFLICT (idempotency_key) DO NOTHING;
    RETURN v_result;
  END IF;

  -- All guards passed. Every statement below runs inside this single
  -- function invocation's transaction: if any one of them raises (for
  -- example a NOT NULL/CHECK violation on referral_notifications), Postgres
  -- rolls back the entire invocation, including the conversion/balance/event
  -- rows already written above -- nothing partially commits.
  INSERT INTO referral_conversions (referral_code, new_user_id) VALUES (p_code, p_new_user_id);
  INSERT INTO referral_recipients (referred_user_id, referral_code) VALUES (p_new_user_id, p_code);

  UPDATE referral_codes SET uses = uses + 1, credits_awarded = credits_awarded + v_credits WHERE code = p_code;

  INSERT INTO referral_credit_balances (user_id, balance, updated_at)
  VALUES (v_owner_id, v_credits, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = referral_credit_balances.balance + v_credits, updated_at = NOW();

  INSERT INTO system_events (event_type, payload, created_at)
  VALUES (
    'referral_conversion',
    jsonb_build_object('code', p_code, 'referrer_id', v_owner_id, 'new_user', p_new_user_id, 'credits', v_credits),
    NOW()
  );

  INSERT INTO referral_notifications (user_id, notif_type, payload) VALUES
    (v_owner_id, 'referral_credit_awarded', jsonb_build_object('credits', v_credits, 'referred_user', p_new_user_id, 'code', p_code)),
    (p_new_user_id, 'referral_code_applied', jsonb_build_object('code', p_code, 'referrer_id', v_owner_id));

  v_result := jsonb_build_object('status', 'ok', 'reason', NULL, 'credits_awarded', v_credits, 'owner_id', v_owner_id);

  INSERT INTO referral_events (idempotency_key, referral_code, new_user_id, status, reason, result)
  VALUES (p_idempotency_key, p_code, p_new_user_id, 'ok', NULL, v_result)
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
