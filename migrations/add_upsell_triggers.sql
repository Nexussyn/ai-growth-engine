-- Migration: Upsell triggers (Issue #3)
-- Idempotent: safe to run multiple times
-- Fires when user reaches 50% of free call limit (5th call out of 10)

CREATE TABLE IF NOT EXISTS upsell_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'free_limit_50pct',
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  converted BOOLEAN DEFAULT FALSE,
  prompt_variant TEXT DEFAULT 'A',
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, trigger_type)
);

CREATE INDEX IF NOT EXISTS idx_upsell_triggers_user_id ON upsell_triggers(user_id);
CREATE INDEX IF NOT EXISTS idx_upsell_triggers_shown_at ON upsell_triggers(shown_at);
CREATE INDEX IF NOT EXISTS idx_upsell_triggers_converted ON upsell_triggers(converted) WHERE converted = FALSE;

-- Mark a trigger as converted
CREATE OR REPLACE FUNCTION mark_upsell_converted(p_user_id TEXT, p_trigger_type TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE upsell_triggers SET converted = TRUE
  WHERE user_id = p_user_id AND trigger_type = p_trigger_type;
END;
$$ LANGUAGE plpgsql;

-- Check and fire upsell trigger if threshold crossed
CREATE OR REPLACE FUNCTION check_upsell_trigger(p_user_id TEXT, p_call_count INT)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_variant TEXT;
BEGIN
  -- Fire at 5th call (50% of 10 free calls)
  IF p_call_count = 5 THEN
    -- Deterministic A/B variant assignment based on user_id hash
    v_variant CASE WHEN ('x' || substr(md5(p_user_id), 1, 8))::bit(32)::int % 2 = 0 THEN 'A' ELSE 'B' END;

    INSERT INTO upsell_triggers (user_id, trigger_type, prompt_variant)
    VALUES (p_user_id, 'free_limit_50pct', v_variant)
    ON CONFLICT (user_id, trigger_type) DO NOTHING;

    IF v_variant = 'A' THEN
      v_result := jsonb_build_object('upsell', true, 'variant', 'A', 'prompt', 'You have used 50% of your free calls. Upgrade now for unlimited access and priority support.');
    ELSE
      v_result := jsonb_build_object('upsell', true, 'variant', 'B', 'prompt', 'Halfway there! You have 5 free calls remaining. Unlock unlimited calls with our Pro plan.');
    END IF;

    RETURN v_result;
  END IF;

  v_result := jsonb_build_object('upsell', false);
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;