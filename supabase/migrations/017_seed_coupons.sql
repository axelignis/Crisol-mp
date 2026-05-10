-- ============================================================
-- CRISOL — Migracion 017: Seed de cupones para QA
-- Cupones minimos para validacion E2E de COUP-01/02/03.
-- Idempotente: ON CONFLICT DO NOTHING por code (UNIQUE).
-- Admin CRUD completo: diferido a Phase 5.
-- ============================================================

INSERT INTO coupon (code, discount_type, discount_value, min_order, uses_limit, expires_at, is_active)
VALUES
  ('CRISOL10',    'percentage', 10,   NULL,   NULL, NULL,                          true),
  ('BIENVENIDA',  'fixed',      5000, 30000,  100,  NULL,                          true),
  ('EXPIRADO',    'percentage', 20,   NULL,   NULL, '2024-01-01T00:00:00+00:00'::timestamptz, true)
ON CONFLICT (code) DO NOTHING;
