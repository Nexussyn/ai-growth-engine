-- Create referral_codes table
CREATE TABLE referral_codes (
  code TEXT PRIMARY KEY,
  owner_id UUID NOT NULL,
  uses INTEGER DEFAULT 0,
  credits_awarded BOOLEAN DEFAULT FALSE
);

-- Create system_events table if not exists
CREATE TABLE IF NOT EXISTS system_events (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  user_id UUID NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);