CREATE TABLE IF NOT EXISTS processed_stripe_events (
  id BIGSERIAL PRIMARY KEY,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  livemode BOOLEAN NOT NULL DEFAULT FALSE,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('PROCESSING', 'PROCESSED', 'FAILED')),
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_received_at
  ON processed_stripe_events (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_processing_status
  ON processed_stripe_events (processing_status);
