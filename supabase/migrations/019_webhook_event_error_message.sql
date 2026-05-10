-- ============================================================
-- CRISOL — Migracion 019: webhook_event.error_message
-- Flag para reconciliacion manual escrito por /api/webhooks/stripe
-- (Plan 05) cuando un evento procesado requiere intervencion:
-- stock insuficiente post-pago, falla en payout ledger, etc.
-- Forward-only.
-- ============================================================

ALTER TABLE webhook_event
  ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMENT ON COLUMN webhook_event.error_message IS 'NULL si el evento se proceso sin incidentes. Texto si requiere reconciliacion manual (e.g., stock insuficiente, transfer fallido).';
