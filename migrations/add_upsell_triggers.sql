-- ============================================================
-- Migration: add_upsell_triggers
-- Issue: #3 [AGENT-TASK] Auto-upsell trigger after 5th free call
-- Purpose: Persist contextual upgrade prompts so we can track
--          whether a user converted after seeing the prompt.
-- ============================================================

-- Track every upsell prompt we surface to a user.
CREATE TABLE IF NOT EXISTS upsell_triggers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL,
    trigger_type  TEXT NOT NULL DEFAULT 'free_credit_threshold',
    -- The usage snapshot that caused the trigger (e.g. "5/10 free calls")
    usage_snapshot TEXT,
    -- Which A/B variant of the prompt text was shown
    variant       TEXT NOT NULL DEFAULT 'A',
    -- When the prompt was first shown to the user
    shown_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Whether the user converted to a paid tier after seeing the prompt
    converted     BOOLEAN NOT NULL DEFAULT FALSE,
    -- When the user converted (NULL until conversion)
    converted_at  TIMESTAMPTZ,
    -- Idempotency key: one trigger per user per threshold crossing.
    -- Composite unique on (user_id, trigger_type) guarantees the
    -- trigger fires exactly once per threshold.
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce idempotency: a user can only have ONE row per trigger_type.
-- This is the core guarantee that the trigger fires exactly once.
CREATE UNIQUE INDEX IF NOT EXISTS idx_upsell_triggers_user_type
    ON upsell_triggers (user_id, trigger_type);

-- Fast lookup for "has this user already been triggered?"
CREATE INDEX IF NOT EXISTS idx_upsell_triggers_user_id
    ON upsell_triggers (user_id);

-- Track conversion funnel
CREATE INDEX IF NOT EXISTS idx_upsell_triggers_converted
    ON upsell_triggers (converted) WHERE converted = FALSE;

-- updated_at maintenance
CREATE OR REPLACE FUNCTION touch_upsell_triggers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_upsell_triggers_touch ON upsell_triggers;
CREATE TRIGGER trg_upsell_triggers_touch
    BEFORE UPDATE ON upsell_triggers
    FOR EACH ROW
    EXECUTE FUNCTION touch_upsell_triggers_updated_at();

-- Comment for discoverability
COMMENT ON TABLE upsell_triggers IS
    'Contextual upgrade prompts shown to free-tier users at usage thresholds. '
    'One row per user per trigger_type (idempotent).';
