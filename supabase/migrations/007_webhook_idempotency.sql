-- ============================================================
-- CRISOL -- Migracion 007: Webhook idempotency
-- Previene procesamiento duplicado de eventos Stripe/Coinbase.
-- ============================================================

CREATE TABLE webhook_event (
  id           TEXT PRIMARY KEY,               -- event ID from provider (evt_... / charge:...)
  source       TEXT NOT NULL CHECK (source IN ('stripe', 'coinbase')),
  event_type   TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload      JSONB
);

COMMENT ON TABLE  webhook_event        IS 'Idempotencia de webhooks. PK es el event.id del proveedor.';
COMMENT ON COLUMN webhook_event.source IS 'stripe | coinbase';
COMMENT ON COLUMN webhook_event.payload IS 'Payload completo del evento para auditoria.';
