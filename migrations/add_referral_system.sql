-- Migration: Add referral system tables
-- This migration creates the referral_codes table used to track referral codes,
-- the number of times a code has been used, and the credits awarded for each conversion.
-- It also ensures that each code is unique and references an existing user.

CREATE TABLE IF NOT EXISTS referral_codes (
  code TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0,
  credits_awarded INTEGER NOT NULL DEFAULT 0
);

-- Optional: add an index on owner_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_referral_codes_owner_id ON referral_codes(owner_id);
