-- Migration: Add referral reward system
-- Awards 5 free credits per successful referral conversion

-- Referral codes table
CREATE TABLE IF NOT EXISTS referral_codes (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_conversions INT NOT NULL DEFAULT 0,
    total_credits_awarded NUMERIC(10, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);

-- Referral conversions table
CREATE TABLE IF NOT EXISTS referral_conversions (
    id SERIAL PRIMARY KEY,
    referral_code_id INT NOT NULL REFERENCES referral_codes(id),
    referrer_user_id UUID NOT NULL,
    referred_user_id UUID NOT NULL,
    converted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    credits_awarded NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'awarded', 'reversed'))
);

CREATE INDEX IF NOT EXISTS idx_referral_conversions_referrer ON referral_conversions(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_conversions_referred ON referral_conversions(referred_user_id);

-- Function: generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(p_user_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
    v_code VARCHAR(20);
    v_attempts INT := 0;
BEGIN
    LOOP
        v_code := upper(substr(md5(random()::text || p_user_id::text), 1, 8));
        BEGIN
            INSERT INTO referral_codes (user_id, code) VALUES (p_user_id, v_code);
            RETURN v_code;
        EXCEPTION WHEN unique_violation THEN
            v_attempts := v_attempts + 1;
            IF v_attempts > 5 THEN
                RAISE EXCEPTION 'Could not generate unique referral code';
            END IF;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function: process referral conversion
CREATE OR REPLACE FUNCTION process_referral(p_code VARCHAR(20), p_referred_user_id UUID)
RETURNS NUMERIC(10, 2) AS $$
DECLARE
    v_referral_id INT;
    v_referrer_user_id UUID;
    v_credits NUMERIC(10, 2) := 5.00;
BEGIN
    -- Find the referral code
    SELECT id, user_id INTO v_referral_id, v_referrer_user_id
    FROM referral_codes WHERE code = p_code;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid referral code: %', p_code;
    END IF;
    
    -- Prevent self-referral
    IF v_referrer_user_id = p_referred_user_id THEN
        RAISE EXCEPTION 'Cannot refer yourself';
    END IF;
    
    -- Check if already converted
    IF EXISTS (SELECT 1 FROM referral_conversions WHERE referred_user_id = p_referred_user_id) THEN
        RAISE EXCEPTION 'User already converted through a referral';
    END IF;
    
    -- Record conversion
    INSERT INTO referral_conversions (referral_code_id, referrer_user_id, referred_user_id, credits_awarded)
    VALUES (v_referral_id, v_referrer_user_id, p_referred_user_id, v_credits);
    
    -- Update stats
    UPDATE referral_codes 
    SET total_conversions = total_conversions + 1,
        total_credits_awarded = total_credits_awarded + v_credits
    WHERE id = v_referral_id;
    
    RETURN v_credits;
END;
$$ LANGUAGE plpgsql;

-- Function: award referral credits to referrer
CREATE OR REPLACE FUNCTION award_referral_credits()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark as awarded when referred user makes first paid call
    IF NEW.status = 'awarded' THEN
        -- Credit already awarded on conversion
        NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
