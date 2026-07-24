-- Migration: Add Referral System & Event Logging
-- Target: Nexussyn AI Growth Engine Issue #2

CREATE TABLE IF NOT EXISTS referral_codes (
    code VARCHAR(32) PRIMARY KEY,
    owner_id VARCHAR(64) NOT NULL,
    uses INTEGER DEFAULT 0,
    credits_awarded INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referral_conversions (
    id SERIAL PRIMARY KEY,
    referral_code VARCHAR(32) NOT NULL REFERENCES referral_codes(code),
    referrer_id VARCHAR(64) NOT NULL,
    referee_id VARCHAR(64) UNIQUE NOT NULL,
    credits_awarded INTEGER DEFAULT 5,
    converted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_events (
    id SERIAL PRIMARY KEY,
    type VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_notifications (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast user balance and referral queries
CREATE INDEX IF NOT EXISTS idx_referral_owner ON referral_codes(owner_id);
CREATE INDEX IF NOT EXISTS idx_referral_referee ON referral_conversions(referee_id);
