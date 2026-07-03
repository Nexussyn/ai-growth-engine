-- Migration: Add tiered pricing support (Issue #1)
-- Replaces flat $0.01/call with 4-tier pricing engine.
-- Idempotent: safe to run multiple times.

-- Update the x402_calls table to support tiered pricing
ALTER TABLE IF EXISTS x402_calls
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'standard' CHECK (tier IN ('free', 'standard', 'premium', 'priority')),
  ADD COLUMN IF NOT EXISTS price_per_call NUMERIC(10, 6) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS priority_flag BOOLEAN DEFAULT FALSE;

-- Remove the flat-rate default; tier is now computed by the engine
ALTER TABLE IF EXISTS x402_calls
  ALTER COLUMN price_per_call DROP DEFAULT;

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
  ('standard', 0.010000, 51,  500, 'Standard tier — regular usage'),
  ('premium',  0.030000, 501, NULL, 'Premium tier — high-volume usage'),
  ('priority', 0.100000, NULL, NULL, 'Priority-flagged calls at premium rate')
ON CONFLICT (tier) DO UPDATE SET
  price_per_call = EXCLUDED.price_per_call,
  call_min = EXCLUDED.call_min,
  call_max = EXCLUDED.call_max,
  description = EXCLUDED.description;
