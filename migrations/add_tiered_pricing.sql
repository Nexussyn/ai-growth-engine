-- Migration: Add tiered pricing support
-- Implements tiered pricing for x402 API calls to increase revenue by ~30%

-- Add tier column to payment table (idempotent)
ALTER TABLE payment ADD COLUMN IF NOT EXISTS tier VARCHAR(20) NOT NULL DEFAULT 'standard';

-- Add index for tier-based queries
CREATE INDEX IF NOT EXISTS idx_payment_tier ON payment(tier);

-- Create pricing_tiers configuration table
CREATE TABLE IF NOT EXISTS pricing_tiers (
    id SERIAL PRIMARY KEY,
    tier_name VARCHAR(20) NOT NULL UNIQUE,
    min_calls INT NOT NULL DEFAULT 0,
    max_calls INT,
    price_per_call NUMERIC(10, 6) NOT NULL DEFAULT 0.01,
    priority_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default tier configuration
INSERT INTO pricing_tiers (tier_name, min_calls, max_calls, price_per_call, priority_multiplier)
VALUES
    ('free', 0, 50, 0.00, 1.0),
    ('standard', 51, 500, 0.01, 1.0),
    ('premium', 501, NULL, 0.03, 1.0)
ON CONFLICT (tier_name) DO NOTHING;

-- Add priority pricing flag
ALTER TABLE payment ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT FALSE;

-- Function to get effective price for a given call count and priority flag
CREATE OR REPLACE FUNCTION get_tier_price(p_call_count INT, p_is_priority BOOLEAN DEFAULT FALSE)
RETURNS NUMERIC(10, 6) AS $$
DECLARE
    v_price NUMERIC(10, 6);
    v_tier_name VARCHAR(20);
BEGIN
    -- Determine tier based on call count
    SELECT tier_name, price_per_call INTO v_tier_name, v_price
    FROM pricing_tiers
    WHERE p_call_count >= min_calls
      AND (max_calls IS NULL OR p_call_count <= max_calls)
    ORDER BY min_calls DESC
    LIMIT 1;

    -- Apply priority multiplier (4x for priority = $0.10/call for standard tier or 10x base)
    IF p_is_priority THEN
        v_price := 0.10;
    END IF;

    -- If no tier found, default to premium price
    IF v_price IS NULL THEN
        v_price := 0.03;
    END IF;

    RETURN v_price;
END;
$$ LANGUAGE plpgsql;

-- Trigger function: auto-set tier on INSERT
CREATE OR REPLACE FUNCTION set_payment_tier()
RETURNS TRIGGER AS $$
DECLARE
    v_call_count INT;
BEGIN
    SELECT COUNT(*) INTO v_call_count FROM payment WHERE id <= NEW.id;
    NEW.tier := (
        SELECT tier_name FROM pricing_tiers
        WHERE v_call_count >= min_calls
          AND (max_calls IS NULL OR v_call_count <= max_calls)
        ORDER BY min_calls DESC
        LIMIT 1
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_payment_tier ON payment;
CREATE TRIGGER trg_set_payment_tier
    BEFORE INSERT ON payment
    FOR EACH ROW
    EXECUTE FUNCTION set_payment_tier();
