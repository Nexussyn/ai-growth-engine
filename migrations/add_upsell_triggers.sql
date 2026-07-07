-- Migration: add_upsell_triggers
-- Issue: AGENT-TASK #3 — Auto-upsell trigger after 5th free call
-- Creates the upsell_triggers table used to record when a contextual
-- upgrade prompt has been shown to a user, and whether it converted.

CREATE TABLE IF NOT EXISTS upsell_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (user_id, trigger_type)
);

CREATE INDEX IF NOT EXISTS idx_upsell_triggers_user_id
  ON upsell_triggers (user_id);
