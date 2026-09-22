-- Migration: add_upsell_triggers.sql
-- Description: Schema support for automated upsell triggers and user interaction events

CREATE TABLE IF NOT EXISTS upsell_rules (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(64) NOT NULL, -- e.g., 'usage_threshold', 'feature_locked', 'time_based'
    threshold_percent NUMERIC(5, 2) DEFAULT 80.0,
    target_tier VARCHAR(64) NOT NULL,
    discount_code VARCHAR(64),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS upsell_events (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    rule_id VARCHAR(64) REFERENCES upsell_rules(id),
    current_tier VARCHAR(64) NOT NULL,
    suggested_tier VARCHAR(64) NOT NULL,
    trigger_reason TEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'pending', -- 'pending', 'presented', 'converted', 'dismissed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_upsell_events_user ON upsell_events(user_id);
CREATE INDEX IF NOT EXISTS idx_upsell_rules_type ON upsell_rules(trigger_type, is_active);
