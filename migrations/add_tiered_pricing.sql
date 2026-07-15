-- Migration: Add tiered pricing support (Issue #1)
-- Idempotent: safe to run multiple times

ALTER TABLE IF EXISTS x402_calls
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'standard' CHECK (tier IN ('free', 'standard', 'premium', 'priority')),
  ADD COLUMN IF NOT EXISTS price_per_call NUMERIC(10, 6) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS priority_flag BOOLEAN DEFAULT FALSE;

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
  call_max = EXCLUDED.call_max;

CREATE OR REPLACE FUNCTION get_tier_price(call_count INT, priority_flag BOOLEAN DEFAULT FALSE)
RETURNS NUMERIC(10, 6)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN priority_flag THEN 0.100000
    WHEN call_count BETWEEN 1 AND 50 THEN 0.000000
    WHEN call_count BETWEEN 51 AND 500 THEN 0.010000
    WHEN call_count >= 501 THEN 0.030000
    ELSE NULL
  END;
$$;
