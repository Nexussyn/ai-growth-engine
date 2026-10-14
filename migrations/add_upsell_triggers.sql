-- Migration: Upsell triggers (Issue #3)
-- Idempotent: safe to run multiple times.
--
-- Fixes two defects in the original version:
--   1. The trigger was gated on `p_call_count = 5` (exact equality), so a user
--      who skipped from call 4 to call 6 never got prompted. It is now a
--      crossing check: `p_call_count >= threshold`.
--   2. `ON CONFLICT ... DO NOTHING` was followed by an unconditional
--      `RETURN upsell = true`, so every repeat call at the threshold reported a
--      new prompt. The function now returns `upsell = true` only for the insert
--      that actually won the race (RETURNING id).

CREATE TABLE IF NOT EXISTS upsell_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'free_limit_50pct',
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  converted BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, trigger_type)
);

-- 50% of the 10 free calls granted per user.
CREATE OR REPLACE FUNCTION check_upsell_trigger(p_user_id TEXT, p_call_count INT)
RETURNS JSONB AS $$
DECLARE
  v_trigger_type TEXT := 'free_limit_50pct';
  v_threshold INT := 5;
  v_inserted_id UUID;
BEGIN
  -- Fire on any call at or beyond the threshold (crossing, not equality),
  -- so skipping from 4 -> 6 still prompts.
  IF p_call_count IS NULL OR p_call_count < v_threshold THEN
    RETURN jsonb_build_object('upsell', false);
  END IF;

  -- Only the caller whose insert wins reports a trigger.
  INSERT INTO upsell_triggers (user_id, trigger_type)
  VALUES (p_user_id, v_trigger_type)
  ON CONFLICT (user_id, trigger_type) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN jsonb_build_object('upsell', false);
  END IF;

  RETURN jsonb_build_object(
    'upsell', true,
    'trigger_type', v_trigger_type,
    'prompt', 'You have used 50% of your free calls. Upgrade for unlimited access.'
  );
END;
$$ LANGUAGE plpgsql;
