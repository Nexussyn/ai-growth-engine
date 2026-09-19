-- Migration: add_referral_system.sql
-- Description: Adds referral tracking and loop system

CREATE TABLE IF NOT EXISTS referral_codes (
    code VARCHAR(50) PRIMARY KEY,
    owner_id UUID NOT NULL,
    uses INTEGER DEFAULT 0,
    credits_awarded INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referral_uses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) REFERENCES referral_codes(code),
    new_user_id UUID NOT NULL UNIQUE, -- Idempotency: a user can only be referred once
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_referral_codes_owner ON referral_codes(owner_id);
CREATE INDEX idx_referral_uses_user ON referral_uses(new_user_id);
