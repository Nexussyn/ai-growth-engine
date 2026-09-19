-- Migration: add_upsell_triggers.sql
-- Description: Adds upsell triggers table for conversion funnel

CREATE TABLE IF NOT EXISTS upsell_triggers (
    user_id UUID NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    shown_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    converted BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (user_id, trigger_type)
);

CREATE INDEX idx_upsell_triggers_user ON upsell_triggers(user_id);
