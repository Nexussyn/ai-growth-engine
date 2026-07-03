-- Migration: Content Agent Table (Issue #5)
-- Creates the outreach_sent table for storing generated content
-- Idempotent: safe to run multiple times

CREATE TABLE IF NOT EXISTS outreach_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'content_agent',
  content JSONB NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_bounty_id ON outreach_sent(bounty_id);
CREATE INDEX IF NOT EXISTS idx_outreach_channel ON outreach_sent(channel);
