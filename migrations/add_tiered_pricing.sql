-- Migration: Add tiered pricing support (Issue #1)
-- Idempotent: safe to run multiple times

CREATE TABLE IF NOT EXISTS x402_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id TEXT,
  call_count INT DEFAULT 0,
  amount_usdc NUMERIC(10, 6) DEFAULT 0.01,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE x402_calls
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'standard';

ALTER TABLE x402_calls
  ADD COLUMN IF NOT EXISTS price_per_call NUMERIC(10, 6) DEFAULT 0.01;

ALTER TABLE x402_calls
  ADD COLUMN IF NOT EXISTS priority_flag BOOLEAN DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'x402_calls_tier_check'
  ) THEN
    ALTER TABLE x402_calls
      ADD CONSTRAINT x402_calls_tier_check
      CHECK (tier IN ('free', 'standard', 'premium', 'priority'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT UNIQUE NOT NULL CHECK (tier IN ('free', 'standard', 'premium', 'priority')),
  price_per_call NUMERIC(10, 6) NOT NULL,
  call_min INT,
  call_max INT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO pricing_tiers (tier, price_per_call, call_min, call_max, description)
VALUES
  ('free',     0.000000, 1,   50,  'First 50 calls free'),
  ('standard', 0.010000, 51,  500, 'Standard tier'),
  ('premium',  0.030000, 501, NULL,'Premium tier'),
  ('priority', 0.100000, NULL, NULL,'Priority flagged calls')
ON CONFLICT (tier) DO UPDATE SET
  price_per_call = EXCLUDED.price_per_call,
  call_min = EXCLUDED.call_min,
  call_max = EXCLUDED.call_max,
  description = EXCLUDED.description;
