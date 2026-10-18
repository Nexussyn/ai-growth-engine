-- Migration: add_upsell_triggers
-- Creates the upsell_triggers table used to record contextual upgrade prompts.
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS upsell_triggers (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT      NOT NULL,
    trigger_type  TEXT        NOT NULL,
    shown_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    converted     BOOLEAN     NOT NULL DEFAULT FALSE,
    -- Idempotency guard: a given user can only cross a given threshold once.
    CONSTRAINT upsell_triggers_user_threshold_unique
        UNIQUE (user_id, trigger_type)
);

CREATE INDEX IF NOT EXISTS idx_upsell_triggers_user_id
    ON upsell_triggers (user_id);

CREATE INDEX IF NOT EXISTS idx_upsell_triggers_converted
    ON upsell_triggers (converted)
    WHERE converted = TRUE;
