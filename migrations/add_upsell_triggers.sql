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
  v_inserted BOOLEAN := FALSE;
  v_variant TEXT;
  v_prompt TEXT;
  v_variant_bucket INT;
BEGIN
  -- Fire at 5th call (50% of 10 free calls)
  IF p_call_count = 5 THEN
    WITH created AS (
      INSERT INTO upsell_triggers (user_id, trigger_type)
      VALUES (p_user_id, 'free_limit_50pct')
      ON CONFLICT (user_id, trigger_type) DO NOTHING
      RETURNING 1
    )
    SELECT EXISTS (SELECT 1 FROM created) INTO v_inserted;

    IF NOT v_inserted THEN
      RETURN jsonb_build_object('upsell', false, 'reason', 'already_triggered');
    END IF;

    SELECT COALESCE(SUM(ascii(substr(p_user_id, idx, 1))), 0)::INT
      INTO v_variant_bucket
      FROM generate_series(1, char_length(p_user_id)) AS idx;

    v_variant := CASE WHEN v_variant_bucket % 2 = 0 THEN 'priority' ELSE 'savings' END;
    v_prompt := CASE v_variant
      WHEN 'priority' THEN 'You have used 50% of your free calls. Upgrade now to unlock priority execution.'
      ELSE 'You have used 50% of your free calls. Upgrade before the free limit ends.'
    END;

    RETURN jsonb_build_object('upsell', true, 'variant', v_variant, 'prompt', v_prompt);
  END IF;

  RETURN jsonb_build_object('upsell', false);
END;
$$ LANGUAGE plpgsql;
