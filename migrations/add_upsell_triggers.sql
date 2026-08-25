-- Migration: Upsell triggers (Issue #3)
-- Idempotent: safe to re-run

CREATE TABLE IF NOT EXISTS upsell_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'free_limit_50pct',
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  converted BOOLEAN DEFAULT FALSE,
  variant TEXT DEFAULT 'A',
  prompt TEXT,
  UNIQUE(user_id, trigger_type)
);

CREATE INDEX IF NOT EXISTS idx_upsell_triggers_user
  ON upsell_triggers (user_id);

CREATE OR REPLACE FUNCTION check_upsell_trigger(p_user_id TEXT, p_call_count INT)
RETURNS JSONB AS $$
DECLARE
  v_existing UUID;
  v_prompt TEXT := 'You have used 50% of your free calls. Upgrade for unlimited access.';
BEGIN
  -- Fire exactly at 5th call (50% of 10 free calls)
  IF p_call_count IS DISTINCT FROM 5 THEN
    RETURN jsonb_build_object('upsell', false, 'reason', 'not_threshold');
  END IF;

  SELECT id INTO v_existing
  FROM upsell_triggers
  WHERE user_id = p_user_id AND trigger_type = 'free_limit_50pct';

  IF FOUND THEN
    RETURN jsonb_build_object('upsell', false, 'reason', 'already_shown');
  END IF;

  INSERT INTO upsell_triggers (user_id, trigger_type, prompt, variant)
  VALUES (p_user_id, 'free_limit_50pct', v_prompt, 'A')
  ON CONFLICT (user_id, trigger_type) DO NOTHING;

  RETURN jsonb_build_object(
    'upsell', true,
    'prompt', v_prompt,
    'header', 'X-Upsell-Prompt: true'
  );
END;
$$ LANGUAGE plpgsql;
