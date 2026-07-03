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
BEGIN
  -- Fire at 5th call (50% of 10 free calls)
  IF p_call_count = 5 THEN
    INSERT INTO upsell_triggers (user_id, trigger_type)
    VALUES (p_user_id, 'free_limit_50pct')
    ON CONFLICT (user_id, trigger_type) DO NOTHING;

    RETURN jsonb_build_object('upsell', true, 'prompt', 'You have used 50% of your free calls. Upgrade for unlimited access.');
  END IF;
  RETURN jsonb_build_object('upsell', false);
END;
$$ LANGUAGE plpgsql;
