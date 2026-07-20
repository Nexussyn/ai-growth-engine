-- Referral system (issue #2)
CREATE TABLE IF NOT EXISTS referral_codes (
  code            TEXT PRIMARY KEY,
  owner_id        TEXT NOT NULL,
  uses            INTEGER NOT NULL DEFAULT 0,
  credits_awarded INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_redemptions (
  id              BIGSERIAL PRIMARY KEY,
  code            TEXT NOT NULL REFERENCES referral_codes(code),
  new_user_id     TEXT NOT NULL,
  awarded_credits INTEGER NOT NULL DEFAULT 5,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code, new_user_id),
  UNIQUE (new_user_id)  -- one referral attribution per user
);

CREATE TABLE IF NOT EXISTS system_events (
  id          BIGSERIAL PRIMARY KEY,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_credits (
  user_id     TEXT PRIMARY KEY,
  free_credits INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
