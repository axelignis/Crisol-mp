-- ============================================================
-- CRISOL — Migracion 018: RPC decrement_stock_atomic
-- Phase 3 D-06: el decremento atomico ocurre en el webhook de
-- payment_intent.succeeded (Plan 05). FOR UPDATE row locks
-- previenen oversell bajo concurrencia (Pitfall 4 del research).
-- Forward-only.
-- ============================================================

CREATE OR REPLACE FUNCTION decrement_stock_atomic(p_items jsonb)
RETURNS TABLE(variant_id uuid, available int, requested int, ok boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  current_stock int;
BEGIN
  FOR r IN
    SELECT (e->>'variantId')::uuid AS vid,
           (e->>'qty')::int        AS qty
    FROM jsonb_array_elements(p_items) AS e
  LOOP
    -- Lock row to serialize concurrent webhooks for the same variant.
    PERFORM 1
    FROM product_variant
    WHERE id = r.vid
    FOR UPDATE;

    SELECT stock INTO current_stock
    FROM product_variant
    WHERE id = r.vid;

    IF current_stock IS NULL THEN
      variant_id := r.vid;
      available  := 0;
      requested  := r.qty;
      ok         := false;
      RETURN NEXT;
    ELSIF current_stock < r.qty THEN
      variant_id := r.vid;
      available  := current_stock;
      requested  := r.qty;
      ok         := false;
      RETURN NEXT;
    ELSE
      UPDATE product_variant
      SET stock = stock - r.qty
      WHERE id = r.vid
      RETURNING stock INTO current_stock;

      variant_id := r.vid;
      available  := current_stock;
      requested  := r.qty;
      ok         := true;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION decrement_stock_atomic(jsonb) IS 'Phase 3 D-06: chequeo y decremento atomico de stock para multiples variantes. Toma FOR UPDATE locks por fila. Consumido por /api/webhooks/stripe (Plan 05). p_items: [{variantId, qty}, ...]. Retorna una fila por variante con ok=true si se decremento, ok=false si stock insuficiente o variante inexistente.';
