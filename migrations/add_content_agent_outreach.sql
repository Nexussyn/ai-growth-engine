-- Migration: Content agent outreach storage (Issue #5)
-- Idempotent

CREATE TABLE IF NOT EXISTS outreach_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'content_agent',
  content JSONB NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_sent_bounty_id
  ON outreach_sent (bounty_id);

CREATE INDEX IF NOT EXISTS idx_outreach_sent_channel_sent_at
  ON outreach_sent (channel, sent_at DESC);
