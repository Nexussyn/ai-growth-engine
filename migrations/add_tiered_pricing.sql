-- Migration: Add tiered pricing support (Issue #1)
-- Idempotent: safe to run multiple times across x402_calls and payment tables

BEGIN;

-- 1. Add tier columns to x402_calls payment table
ALTER TABLE IF EXISTS x402_calls
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'standard' CHECK (tier IN ('free', 'standard', 'premium', 'priority')),
  ADD COLUMN IF NOT EXISTS price_per_call NUMERIC(10, 6) DEFAULT 0.010000 CHECK (price_per_call >= 0),
  ADD COLUMN IF NOT EXISTS priority_flag BOOLEAN DEFAULT FALSE NOT NULL;

-- Also ensure payments table (if present) carries the tier column
ALTER TABLE IF EXISTS payments
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'standard' CHECK (tier IN ('free', 'standard', 'premium', 'priority')),
  ADD COLUMN IF NOT EXISTS price_per_call NUMERIC(10, 6) DEFAULT 0.010000 CHECK (price_per_call >= 0),
  ADD COLUMN IF NOT EXISTS priority_flag BOOLEAN DEFAULT FALSE;

-- 2. Create pricing_tiers reference table
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT UNIQUE NOT NULL CHECK (tier IN ('free', 'standard', 'premium', 'priority')),
  price_per_call NUMERIC(10, 6) NOT NULL CHECK (price_per_call >= 0),
  call_min INT,
  call_max INT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Upsert canonical 4-tier schedule
INSERT INTO pricing_tiers (tier, price_per_call, call_min, call_max, description)
VALUES
  ('free',     0.000000, 1,    50,   'First 50 calls free ($0.00/call)'),
  ('standard', 0.010000, 51,   500,  'Standard tier calls 51-500 ($0.01/call)'),
  ('premium',  0.030000, 501,  NULL, 'Premium tier calls 500+ ($0.03/call)'),
  ('priority', 0.100000, NULL, NULL, 'Priority flagged calls ($0.10/call)')
ON CONFLICT (tier) DO UPDATE SET
  price_per_call = EXCLUDED.price_per_call,
  call_min = EXCLUDED.call_min,
  call_max = EXCLUDED.call_max,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 4. Indexes for fast billing and analytics queries
CREATE INDEX IF NOT EXISTS idx_x402_calls_tier ON x402_calls (tier);
CREATE INDEX IF NOT EXISTS idx_x402_calls_priority_flag ON x402_calls (priority_flag) WHERE priority_flag = TRUE;

-- 5. Deterministic SQL pricing helper function matching src/pricing/tier-engine.ts
CREATE OR REPLACE FUNCTION get_tier_price(p_call_count INT, p_priority_flag BOOLEAN DEFAULT FALSE)
RETURNS TABLE(tier TEXT, price_per_call NUMERIC(10, 6))
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_call_count IS NULL OR p_call_count < 0 THEN
    RAISE EXCEPTION 'call_count must be a non-negative integer, got %', p_call_count;
  END IF;

  IF COALESCE(p_priority_flag, FALSE) THEN
    RETURN QUERY SELECT 'priority'::TEXT, 0.100000::NUMERIC(10, 6);
  ELSIF p_call_count <= 50 THEN
    RETURN QUERY SELECT 'free'::TEXT, 0.000000::NUMERIC(10, 6);
  ELSIF p_call_count <= 500 THEN
    RETURN QUERY SELECT 'standard'::TEXT, 0.010000::NUMERIC(10, 6);
  ELSE
    RETURN QUERY SELECT 'premium'::TEXT, 0.030000::NUMERIC(10, 6);
  END IF;
END;
$$;

COMMIT;
