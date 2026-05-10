-- ============================================================
-- CRISOL — Migracion 020: reserve_coupon RPC (atomic)
-- Phase 3 Plan 04 — D-15 race fix.
-- UPDATE condicional + RETURNING garantiza que uses_count nunca
-- sobrepasa uses_limit, incluso bajo concurrencia. El webhook
-- (Plan 05) NO re-incrementa; solo asocia coupon_id al order.
-- TODO(phase-5): cleanup job para PIs abandonados (uses_count
-- queda inflado si el comprador abandona).
-- ============================================================

CREATE OR REPLACE FUNCTION reserve_coupon(p_code TEXT, p_subtotal INTEGER)
RETURNS TABLE(id UUID, discount_type TEXT, discount_value INTEGER)
LANGUAGE sql
AS $$
  UPDATE coupon
     SET uses_count = uses_count + 1
   WHERE code = upper(trim(p_code))
     AND is_active = true
     AND (expires_at IS NULL OR expires_at > now())
     AND (uses_limit IS NULL OR uses_count < uses_limit)
     AND (min_order  IS NULL OR min_order  <= p_subtotal)
   RETURNING id, discount_type::TEXT, discount_value;
$$;

COMMENT ON FUNCTION reserve_coupon(TEXT, INTEGER) IS
  'Reserva atomica de cupon (uses_count++) con UPDATE condicional. '
  'Llamado por /api/checkout/payment-intent antes de crear el PI. '
  'Retorna 0 filas si el cupon esta inactivo, expirado, agotado o no cumple min_order.';
