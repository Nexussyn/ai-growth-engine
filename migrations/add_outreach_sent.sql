-- Migration: outreach_sent table for content-generation agent (Issue #5)
CREATE TABLE IF NOT EXISTS public.outreach_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'content_agent',
  content JSONB NOT NULL,
  external_post_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_sent_bounty_id
  ON public.outreach_sent (bounty_id, sent_at DESC);
