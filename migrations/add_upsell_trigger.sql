-- Migration: Auto-upsell trigger after 5th free call
CREATE TABLE IF NOT EXISTS upsell_triggers (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    free_call_count INT NOT NULL DEFAULT 0,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    prompt_text TEXT,
    prompt_shown BOOLEAN NOT NULL DEFAULT FALSE,
    upsell_converted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_upsell_triggers_user ON upsell_triggers(user_id);

CREATE OR REPLACE FUNCTION check_upsell_trigger(p_user_id UUID, p_free_call_count INT)
RETURNS TABLE(should_prompt BOOLEAN, prompt_text TEXT) AS $$
BEGIN
    IF p_free_call_count >= 5 AND p_free_call_count % 5 = 0 THEN
        IF NOT EXISTS (SELECT 1 FROM upsell_triggers WHERE user_id = p_user_id AND free_call_count = p_free_call_count) THEN
            INSERT INTO upsell_triggers (user_id, free_call_count, prompt_text)
            VALUES (p_user_id, p_free_call_count, 'You have used 50% of your free credits. Upgrade to Standard for unlimited access and premium features.');
        END IF;
        RETURN QUERY SELECT true, 'You have used 50% of your free credits. Upgrade to Standard for unlimited access and premium features.'::TEXT;
    END IF;
    RETURN QUERY SELECT false, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;
