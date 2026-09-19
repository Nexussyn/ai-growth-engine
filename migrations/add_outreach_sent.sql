-- Issue #5: store generated outreach per bounty (idempotent)
CREATE TABLE IF NOT EXISTS outreach_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id TEXT NOT NULL UNIQUE,
  tweet TEXT NOT NULL,
  thread JSONB NOT NULL DEFAULT '[]'::jsonb,
  blog_post TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
