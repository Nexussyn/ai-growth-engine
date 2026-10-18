-- Migration: add_upsell_triggers
-- Creates the upsell_triggers table used to track contextual upgrade prompts.
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS upsell_triggers (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT      NOT NULL,
    trigger_type  TEXT        NOT NULL,
    shown_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    converted     BOOLEAN     NOT NULL DEFAULT FALSE,
    converted_at  TIMESTAMPTZ,
    metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT upsell_triggers_user_type_unique UNIQUE (user_id, trigger_type)
);

-- Fast lookup of a user's triggers.
CREATE INDEX IF NOT EXISTS idx_upsell_triggers_user_id
    ON upsell_triggers (user_id);

-- Fast lookup of unconverted triggers for analytics / retargeting.
CREATE INDEX IF NOT EXISTS idx_upsell_triggers_converted
    ON upsell_triggers (converted)
    WHERE converted = FALSE;

COMMENT ON TABLE upsell_triggers IS
    'Records contextual upgrade prompts shown to users at usage thresholds.';
COMMENT ON COLUMN upsell_triggers.trigger_type IS
    'Threshold identifier, e.g. free_calls_50pct.';
COMMENT ON COLUMN upsell_triggers.shown_at IS
    'Timestamp when the prompt was first shown to the user.';
COMMENT ON COLUMN upsell_triggers.converted IS
    'Whether the user upgraded after seeing this trigger.';
