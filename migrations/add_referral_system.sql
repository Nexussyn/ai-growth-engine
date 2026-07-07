-- Migration: add_referral_system.sql
-- Issue: [AGENT-TASK] Implement referral reward loop — +20% conversion
-- Creates tables required for the referral reward loop.

-- Table: referral_codes
-- Each row represents a unique referral code owned by a user.
CREATE TABLE IF NOT EXISTS referral_codes (
  code TEXT PRIMARY KEY,
  owner_id UUID NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0,
  credits_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_owner_id ON referral_codes (owner_id);

-- Table: referral_redemptions
-- Tracks which users have redeemed which referral codes to guarantee idempotency
-- (a given referral code cannot be used twice by the same new user).
CREATE TABLE IF NOT EXISTS referral_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code TEXT NOT NULL REFERENCES referral_codes (code),
  new_user_id UUID NOT NULL,
  credits_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (referral_code, new_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_redemptions_new_user_id ON referral_redemptions (new_user_id);

-- Table: system_events (created if it doesn't already exist elsewhere)
-- Generic event log used across the platform, including referral_conversion events.
CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_events_event_type ON system_events (event_type);

-- Table: notifications (created if it doesn't already exist elsewhere)
-- Simple notification queue/table so users see referral conversion notices.
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);

-- Table: user_credits (assumed minimal shape; created if not present elsewhere)
-- Tracks free credit balances per user.
CREATE TABLE IF NOT EXISTS user_credits (
  user_id UUID PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
