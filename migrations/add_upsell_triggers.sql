-- Create upsell_triggers table
CREATE TABLE IF NOT EXISTS upsell_triggers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  shown_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  converted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (user_id, trigger_type)
);

-- Insert trigger for existing users who have made 5 free calls
INSERT INTO upsell_triggers (user_id, trigger_type, shown_at, converted)
SELECT id, 'free_call_5', CURRENT_TIMESTAMP, FALSE
FROM users
WHERE id IN (
  SELECT user_id
  FROM calls
  GROUP BY user_id
  HAVING COUNT(*) = 5
);
