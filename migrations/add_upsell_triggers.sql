-- Migration: Add upsell triggers (Issue #3)
-- Idempotent

CREATE TABLE IF NOT EXISTS upsell_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT '50_percent_free_limit',
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  converted BOOLEAN DEFAULT FALSE,
  prompt_variant TEXT DEFAULT 'VARIANT_A',
  UNIQUE(user_id, trigger_type)
);

CREATE INDEX IF NOT EXISTS idx_upsell_triggers_user ON upsell_triggers(user_id);
