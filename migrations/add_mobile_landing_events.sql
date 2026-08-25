-- Mobile landing conversion events (Issue #4)
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS system_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_events_type_created
  ON system_events (event_type, created_at DESC);

-- Optional narrow index for mobile CTA analytics
CREATE INDEX IF NOT EXISTS idx_system_events_mobile_cta
  ON system_events ((payload->>'wallet'))
  WHERE event_type = 'mobile_landing_cta_click';

COMMENT ON TABLE system_events IS 'Append-only product events; mobile_landing_cta_click logs wallet CTA taps';
