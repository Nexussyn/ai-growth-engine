-- Create upsell_triggers table
CREATE TABLE upsell_triggers (
  user_id UUID NOT NULL,
  trigger_type TEXT NOT NULL,
  shown_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, trigger_type)
);