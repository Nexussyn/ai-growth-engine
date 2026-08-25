-- Migration: Add Upsell Triggers
CREATE TABLE IF NOT EXISTS upsell_triggers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  variant TEXT NOT NULL,
  prompt_message TEXT NOT NULL,
  shown_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  converted BOOLEAN NOT NULL DEFAULT FALSE,
  converted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_upsell_triggers_user ON upsell_triggers(user_id, trigger_type);
