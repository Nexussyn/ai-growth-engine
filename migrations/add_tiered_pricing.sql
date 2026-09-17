-- Migration: add tiered pricing column
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'Tier 1 (Free)';
