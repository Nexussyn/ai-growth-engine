-- Issue #5: Content agent — outreach_sent table
CREATE TABLE IF NOT EXISTS outreach_sent (
  id SERIAL PRIMARY KEY,
  bounty_id UUID REFERENCES bounty_executions(id),
  channel VARCHAR(50) DEFAULT 'content_agent',
  content JSONB NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outreach_bounty_id ON outreach_sent(bounty_id);
