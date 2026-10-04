-- Migration: Content agent tables (Issue #5)
-- Idempotent: safe to run multiple times

-- Bounty completion events the content agent reads from.
CREATE TABLE IF NOT EXISTS bounty_executions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  reward_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  repo_owner TEXT,
  repo_name TEXT,
  pr_number INT,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated outreach content the content agent persists.
CREATE TABLE IF NOT EXISTS outreach_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id TEXT REFERENCES bounty_executions(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'content_agent',
  content TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_sent_bounty ON outreach_sent(bounty_id);
CREATE INDEX IF NOT EXISTS idx_outreach_sent_channel ON outreach_sent(channel);
