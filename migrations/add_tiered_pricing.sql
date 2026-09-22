-- Migration: add_tiered_pricing
-- Adds a `tier` column to the payments table to store the pricing tier for each API call.
-- This migration is idempotent – it will not fail if run multiple times.

DO $$
BEGIN
    -- Only add the column if it does not already exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'payments'
          AND column_name = 'tier'
    ) THEN
        ALTER TABLE payments
            ADD COLUMN tier TEXT NOT NULL DEFAULT 'standard';
    END IF;
END
$$;
