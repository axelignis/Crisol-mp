-- ============================================================
-- CRISOL — Migracion 015: Restaurar campos bancarios en ARTISAN
-- Phase 3 D-SPLIT: supersede Phase 1 D-02.
-- Stripe Connect (Separate Charges & Transfers) NO esta disponible
-- en Chile. Adoptamos single-account model: Crisol cobra 100% en
-- una cuenta Stripe de plataforma y el admin liquida manualmente
-- a cada artesano via transferencia bancaria.
-- Estos campos describen la cuenta destino del artesano.
-- ============================================================

ALTER TABLE artisan ADD COLUMN IF NOT EXISTS bank_name           TEXT;
ALTER TABLE artisan ADD COLUMN IF NOT EXISTS bank_account_type   TEXT;
ALTER TABLE artisan ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE artisan ADD COLUMN IF NOT EXISTS bank_rut            TEXT;
ALTER TABLE artisan ADD COLUMN IF NOT EXISTS bank_email          TEXT;

ALTER TABLE artisan
  DROP CONSTRAINT IF EXISTS artisan_bank_account_type_check;

ALTER TABLE artisan
  ADD CONSTRAINT artisan_bank_account_type_check
  CHECK (bank_account_type IS NULL
         OR bank_account_type IN ('checking','savings','sight','rut'));

COMMENT ON COLUMN artisan.bank_name           IS 'Nombre del banco destino para liquidacion manual (D-SPLIT).';
COMMENT ON COLUMN artisan.bank_account_type   IS 'checking | savings | sight | rut. Tipo de cuenta destino.';
COMMENT ON COLUMN artisan.bank_account_number IS 'Numero de cuenta destino. PII — RLS restringe a admin + propio artesano.';
COMMENT ON COLUMN artisan.bank_rut            IS 'RUT del titular de la cuenta bancaria.';
COMMENT ON COLUMN artisan.bank_email          IS 'Email para notificacion de transferencia. PII.';

COMMENT ON COLUMN artisan.stripe_account_id   IS 'OBSOLETO (Phase 3 D-SPLIT). Single-account model — Stripe Connect no se usa. Columna preservada nullable por compatibilidad forward-only.';
