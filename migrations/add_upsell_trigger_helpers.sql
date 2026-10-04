-- Migration: Upsell trigger helpers (Issue #3 follow-up)
-- Idempotent: safe to run multiple times (CREATE OR REPLACE).

-- Atomically record a trigger and report whether it FIRED (TRUE) or was
-- already recorded (FALSE). Backs the middleware's exactly-once guarantee:
-- UNIQUE(user_id, trigger_type) from add_upsell_triggers.sql does the dedup.
CREATE OR REPLACE FUNCTION record_upsell_trigger(
  p_user_id TEXT,
  p_trigger_type TEXT DEFAULT 'free_limit_50pct'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_inserted INT;
BEGIN
  INSERT INTO upsell_triggers (user_id, trigger_type)
  VALUES (p_user_id, p_trigger_type)
  ON CONFLICT (user_id, trigger_type) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted > 0;
END;
$$ LANGUAGE plpgsql;

-- Mark a recorded trigger as converted (user upgraded after the prompt).
-- Returns TRUE when a row was updated, FALSE when no trigger existed.
CREATE OR REPLACE FUNCTION mark_upsell_converted(
  p_user_id TEXT,
  p_trigger_type TEXT DEFAULT 'free_limit_50pct'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE upsell_triggers
  SET converted = TRUE
  WHERE user_id = p_user_id AND trigger_type = p_trigger_type;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql;
