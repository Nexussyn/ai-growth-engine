-- Upsell triggers (issue #3): fire once per user/threshold crossing
CREATE TABLE IF NOT EXISTS upsell_triggers (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  trigger_type  TEXT NOT NULL DEFAULT 'free_half_quota',
  shown_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted     BOOLEAN NOT NULL DEFAULT FALSE,
  prompt_variant TEXT,
  UNIQUE (user_id, trigger_type)
);

CREATE INDEX IF NOT EXISTS idx_upsell_triggers_user ON upsell_triggers (user_id);
