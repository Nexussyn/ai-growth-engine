-- Migration: Upsell triggers (Issue #3)
-- Idempotent

CREATE TABLE IF NOT EXISTS upsell_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'free_limit_50pct',
  variant TEXT NOT NULL DEFAULT 'A',
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  converted BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, trigger_type)
);

ALTER TABLE IF EXISTS upsell_triggers
  ADD COLUMN IF NOT EXISTS variant TEXT NOT NULL DEFAULT 'A';

CREATE OR REPLACE FUNCTION check_upsell_trigger(p_user_id TEXT, p_call_count INT, p_free_limit INT DEFAULT 10)
RETURNS JSONB AS $$
DECLARE
  v_threshold INT := GREATEST(1, CEIL(p_free_limit / 2.0)::INT);
  v_variant TEXT;
  v_inserted INT;
  v_remaining INT := GREATEST(0, p_free_limit - p_call_count);
  v_prompt TEXT;
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' OR p_free_limit <= 0 THEN
    RETURN jsonb_build_object('upsell', false);
  END IF;

  IF p_call_count = v_threshold THEN
    v_variant := CASE WHEN MOD(ABS(hashtext(p_user_id)), 2) = 0 THEN 'A' ELSE 'B' END;

    INSERT INTO upsell_triggers (user_id, trigger_type, variant)
    VALUES (p_user_id, 'free_limit_50pct', v_variant)
    ON CONFLICT (user_id, trigger_type) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted > 0 THEN
      IF v_variant = 'A' THEN
        v_prompt := format('You have used 50%% of your free calls (%s remaining). Upgrade now for unlimited access.', v_remaining);
      ELSE
        v_prompt := format('Halfway through your free quota (%s calls left). Unlock Pro for uninterrupted throughput.', v_remaining);
      END IF;

      RETURN jsonb_build_object(
        'upsell', true,
        'variant', v_variant,
        'prompt', v_prompt
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('upsell', false);
END;
$$ LANGUAGE plpgsql;
