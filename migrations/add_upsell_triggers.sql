-- Migration: Upsell triggers (Issue #3)
-- Idempotent

CREATE TABLE IF NOT EXISTS upsell_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'free_limit_50pct',
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  converted BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, trigger_type)
);

CREATE OR REPLACE FUNCTION check_upsell_trigger(p_user_id TEXT, p_call_count INT)
RETURNS JSONB AS $$
DECLARE
  v_inserted_id UUID;
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' THEN
    RAISE EXCEPTION 'user_id must not be empty' USING ERRCODE = '22023';
  END IF;
  IF p_call_count < 0 THEN
    RAISE EXCEPTION 'call_count must not be negative' USING ERRCODE = '22023';
  END IF;
  -- Fire at 5th call (50% of 10 free calls)
  IF p_call_count = 5 THEN
    INSERT INTO upsell_triggers (user_id, trigger_type)
    VALUES (p_user_id, 'free_limit_50pct')
    ON CONFLICT (user_id, trigger_type) DO NOTHING
    RETURNING id INTO v_inserted_id;

    -- A retry or another request may already have won the unique insert.
    IF v_inserted_id IS NULL THEN
      RETURN jsonb_build_object('upsell', false);
    END IF;

    RETURN jsonb_build_object('upsell', true, 'prompt', 'You have used 50% of your free calls. Review upgrade options before your free calls run out.');
  END IF;
  RETURN jsonb_build_object('upsell', false);
END;
$$ LANGUAGE plpgsql;
