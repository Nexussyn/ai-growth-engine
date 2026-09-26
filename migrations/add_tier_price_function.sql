-- Migration: DB-side tiered pricing logic (Issue #1)
-- Idempotent: CREATE OR REPLACE, safe to run multiple times.
--
-- Mirrors src/pricing/tier-engine.ts so callers can compute a call's
-- tier/price inside Postgres (e.g. in an INSERT ... SELECT or a trigger)
-- without duplicating the boundary rules:
--   priority flag          -> 'priority', $0.10
--   call_count 1..50       -> 'free',     $0.00
--   call_count 51..500     -> 'standard', $0.01
--   call_count 501+        -> 'premium',  $0.03
--
-- Example: record a call's priced tier when inserting into x402_calls:
--   INSERT INTO x402_calls (tier, price_per_call, priority_flag)
--   SELECT tier, price_per_call, FALSE
--   FROM get_tier_price(<call_number>, FALSE);
--
-- Raises on call_count < 1, matching the TS validation in tier-engine.ts.

CREATE OR REPLACE FUNCTION get_tier_price(p_call_count INT, p_priority_flag BOOLEAN DEFAULT FALSE)
RETURNS TABLE (tier TEXT, price_per_call NUMERIC(10, 6))
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_call_count IS NULL OR p_call_count < 1 THEN
    RAISE EXCEPTION 'call_count must be a positive integer (1-based call number), got %', p_call_count;
  END IF;

  IF p_priority_flag THEN
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
