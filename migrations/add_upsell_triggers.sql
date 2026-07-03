-- Migration: Upsell triggers (Issue #3)
-- Idempotent — safe to run multiple times
-- Enhanced with A/B test prompt variants and tiered pricing upsell

CREATE TABLE IF NOT EXISTS upsell_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'free_limit_50pct',
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  converted BOOLEAN DEFAULT FALSE,
  variant TEXT DEFAULT 'A',
  UNIQUE(user_id, trigger_type)
);

-- Upsell prompt variants for A/B testing
CREATE TABLE IF NOT EXISTS upsell_prompt_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cta_text TEXT NOT NULL,
  UNIQUE(variant, trigger_type)
);

INSERT INTO upsell_prompt_variants (variant, trigger_type, title, description, cta_text)
VALUES
  ('A', 'free_limit_50pct', 'Unlock Unlimited Access', 'You have used 50% of your free calls. Upgrade to Standard ($0.01/call) or Premium ($0.03/call) for unlimited access. Priority calls at $0.10/call.', 'See Plans'),
  ('B', 'free_limit_50pct', 'You are Halfway There!', '5 calls used — time to go unlimited. Standard: $0.01/call. Premium: $0.03/call. Priority: $0.10/call.', 'Upgrade Now'),
  ('A', 'free_limit_exhausted', 'Free Calls Exhausted', 'You have used all your free calls. Choose a plan to continue: Standard ($0.01/call), Premium ($0.03/call), or Priority ($0.10/call).', 'Choose Plan'),
  ('B', 'free_limit_exhausted', 'Time to Upgrade', 'All free calls used! Pick your tier: Standard, Premium, or Priority. Priority calls get queued first.', 'Pick a Plan')
ON CONFLICT (variant, trigger_type) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  cta_text = EXCLUDED.cta_text;

-- Core upsell trigger function
CREATE OR REPLACE FUNCTION check_upsell_trigger(p_user_id TEXT, p_call_count INT, p_variant TEXT DEFAULT 'A')
RETURNS JSONB AS $$
DECLARE
  v_prompt RECORD;
  v_result JSONB;
BEGIN
  -- Fire at 5th call (50% of 10 free calls)
  IF p_call_count = 5 THEN
    INSERT INTO upsell_triggers (user_id, trigger_type, variant)
    VALUES (p_user_id, 'free_limit_50pct', p_variant)
    ON CONFLICT (user_id, trigger_type) DO NOTHING;

    -- Fetch prompt variant
    SELECT title, description, cta_text INTO v_prompt
    FROM upsell_prompt_variants
    WHERE variant = p_variant AND trigger_type = 'free_limit_50pct';

    v_result := jsonb_build_object(
      'upsell', true,
      'trigger_type', 'free_limit_50pct',
      'prompt', jsonb_build_object(
        'title', COALESCE(v_prompt.title, 'Unlock Unlimited Access'),
        'description', COALESCE(v_prompt.description, 'You have used 50% of your free calls.'),
        'cta', COALESCE(v_prompt.cta_text, 'See Plans'),
        'tiers', jsonb_build_array(
          jsonb_build_object('name', 'Standard', 'price', 0.01, 'unit', 'per call'),
          jsonb_build_object('name', 'Premium', 'price', 0.03, 'unit', 'per call'),
          jsonb_build_object('name', 'Priority', 'price', 0.10, 'unit', 'per call')
        )
      )
    );
    RETURN v_result;
  END IF;

  -- Fire at 10th call (100% exhausted)
  IF p_call_count = 10 THEN
    INSERT INTO upsell_triggers (user_id, trigger_type, variant)
    VALUES (p_user_id, 'free_limit_exhausted', p_variant)
    ON CONFLICT (user_id, trigger_type) DO NOTHING;

    SELECT title, description, cta_text INTO v_prompt
    FROM upsell_prompt_variants
    WHERE variant = p_variant AND trigger_type = 'free_limit_exhausted';

    v_result := jsonb_build_object(
      'upsell', true,
      'trigger_type', 'free_limit_exhausted',
      'prompt', jsonb_build_object(
        'title', COALESCE(v_prompt.title, 'Free Calls Exhausted'),
        'description', COALESCE(v_prompt.description, 'All free calls used. Choose a plan.'),
        'cta', COALESCE(v_prompt.cta_text, 'Choose Plan'),
        'tiers', jsonb_build_array(
          jsonb_build_object('name', 'Standard', 'price', 0.01, 'unit', 'per call'),
          jsonb_build_object('name', 'Premium', 'price', 0.03, 'unit', 'per call'),
          jsonb_build_object('name', 'Priority', 'price', 0.10, 'unit', 'per call')
        )
      )
    );
    RETURN v_result;
  END IF;

  RETURN jsonb_build_object('upsell', false);
END;
$$ LANGUAGE plpgsql;

-- Log upsell shown events
CREATE OR REPLACE FUNCTION log_upsell_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO system_events (event_type, payload, created_at)
  VALUES (
    'upsell_trigger_shown',
    jsonb_build_object(
      'user_id', NEW.user_id,
      'trigger_type', NEW.trigger_type,
      'variant', NEW.variant,
      'shown_at', NEW.shown_at
    ),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_upsell_event ON upsell_triggers;
CREATE TRIGGER trigger_log_upsell_event
  AFTER INSERT ON upsell_triggers
  FOR EACH ROW
  EXECUTE FUNCTION log_upsell_event();