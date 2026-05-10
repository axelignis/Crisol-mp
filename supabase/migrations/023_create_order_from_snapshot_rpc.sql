-- ============================================================
-- CRISOL — Migracion 023: RPC create_order_from_snapshot
-- Phase 3 CR-01 + CR-02 fix.
--
-- Ejecuta toda la creacion de la orden dentro de una sola transaccion
-- plpgsql. Garantiza atomicidad: si CUALQUIER paso falla, todo se
-- revierte (incluyendo el decremento de stock y el incremento de
-- coupon.uses_count). Reemplaza la secuencia previa de INSERTs no
-- transaccional ejecutada desde TS.
--
-- Pasos (todos atomicos):
--   1. SELECT snapshot por id (FOR UPDATE para evitar reuso concurrente).
--   2. Para cada item: lock variant FOR UPDATE, validar stock,
--      decrementar.
--   3. Si snapshot.totals.couponId NOT NULL: incrementar
--      coupon.uses_count condicionalmente (UPDATE con WHERE
--      uses_limit IS NULL OR uses_count < uses_limit). Si 0 filas,
--      retornar error_code = 'COUPON_LIMIT_REACHED'.
--   4. Resolver buyer_row_id desde snapshot.payload.buyer_id (si
--      authUserId presente).
--   5. INSERT order, order_item[], shipping_address, shipment[],
--      payment, artisan_payout[].
--   6. UPDATE order.status = 'paid' (transicion validada
--      pending_payment -> paid).
--
-- Retorna (order_id, error_code):
--   - error_code = NULL → exito.
--   - error_code = 'SNAPSHOT_NOT_FOUND' → snapshot inexistente o
--     expirado.
--   - error_code = 'STOCK_INSUFFICIENT:<variantId>:<available>:<requested>;...'
--     → al menos una variante quedo bajo el qty solicitado. El
--     formato permite reconstruir la lista en TS.
--   - error_code = 'COUPON_LIMIT_REACHED' → cupon agotado entre
--     PI creation y order creation.
--
-- Forward-only.
-- ============================================================

CREATE OR REPLACE FUNCTION create_order_from_snapshot(
  p_snapshot_id UUID,
  p_pi_id       TEXT,
  p_pi_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(order_id UUID, error_code TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_snap          cart_snapshot%ROWTYPE;
  v_payload       JSONB;
  v_totals        JSONB;
  v_item          JSONB;
  v_variant_id    UUID;
  v_qty           INT;
  v_current_stock INT;
  v_insufficient  TEXT := '';
  v_coupon_id     UUID;
  v_buyer_auth_id UUID;
  v_buyer_row_id  UUID;
  v_order_id      UUID;
  v_perItem       JSONB;
  v_shipment      JSONB;
  v_payout        JSONB;
  v_total_artisan_net INT := 0;
  v_per_artisan   JSONB;
  v_today         DATE := CURRENT_DATE;
  v_addr          JSONB;
BEGIN
  -- 1. Snapshot lookup + lock
  SELECT * INTO v_snap
  FROM cart_snapshot
  WHERE id = p_snapshot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, 'SNAPSHOT_NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  v_payload := v_snap.payload;
  v_totals  := v_snap.totals;

  -- 2. Stock check + decrement (FOR UPDATE locks por fila)
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_payload->'items')
  LOOP
    v_variant_id := (v_item->>'variantId')::UUID;
    v_qty        := (v_item->>'qty')::INT;

    PERFORM 1 FROM product_variant WHERE id = v_variant_id FOR UPDATE;

    SELECT stock INTO v_current_stock
    FROM product_variant
    WHERE id = v_variant_id;

    IF v_current_stock IS NULL THEN
      v_insufficient := v_insufficient
        || v_variant_id::TEXT || ':0:' || v_qty::TEXT || ';';
    ELSIF v_current_stock < v_qty THEN
      v_insufficient := v_insufficient
        || v_variant_id::TEXT || ':' || v_current_stock::TEXT || ':' || v_qty::TEXT || ';';
    END IF;
  END LOOP;

  IF length(v_insufficient) > 0 THEN
    -- Abort: no aplicar ningun cambio. plpgsql revierte automaticamente
    -- al retornar (no hubo UPDATE/INSERT aun).
    RETURN QUERY SELECT NULL::UUID, ('STOCK_INSUFFICIENT:' || v_insufficient)::TEXT;
    RETURN;
  END IF;

  -- Aplicar decremento ahora que sabemos que todos pasan
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_payload->'items')
  LOOP
    v_variant_id := (v_item->>'variantId')::UUID;
    v_qty        := (v_item->>'qty')::INT;
    UPDATE product_variant
       SET stock = stock - v_qty
     WHERE id = v_variant_id;
  END LOOP;

  -- 3. Coupon increment atomico (CR-02). Solo si snapshot tiene couponId.
  v_coupon_id := NULLIF(v_totals->>'couponId', '')::UUID;
  IF v_coupon_id IS NOT NULL THEN
    UPDATE coupon
       SET uses_count = uses_count + 1
     WHERE id = v_coupon_id
       AND is_active = true
       AND (expires_at IS NULL OR expires_at > now())
       AND (uses_limit IS NULL OR uses_count < uses_limit);

    IF NOT FOUND THEN
      -- ROLLBACK: la transaccion plpgsql aborta y revierte el decremento de stock.
      RAISE EXCEPTION 'COUPON_LIMIT_REACHED'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 4. Resolver buyer_row_id si snapshot tiene buyer_id auth
  v_buyer_auth_id := NULLIF(v_payload->>'buyer_id', '')::UUID;
  IF v_buyer_auth_id IS NULL THEN
    v_buyer_auth_id := v_snap.buyer_id;
  END IF;
  IF v_buyer_auth_id IS NOT NULL THEN
    SELECT id INTO v_buyer_row_id
    FROM buyer
    WHERE user_id = v_buyer_auth_id;
  END IF;

  -- 5. Insert order
  INSERT INTO "order" (
    buyer_id,
    guest_email,
    subtotal,
    shipping_cost,
    discount_amount,
    commission_amount,
    commission_pct_snapshot,
    total,
    coupon_id
  ) VALUES (
    v_buyer_row_id,
    CASE WHEN v_buyer_row_id IS NULL THEN v_payload->>'email' ELSE NULL END,
    (v_totals->>'subtotal')::INT,
    (v_totals->>'shippingTotal')::INT,
    COALESCE((v_totals->>'discount')::INT, 0),
    (v_totals->>'commission')::INT,
    NULLIF(v_totals->>'commissionPct', '')::NUMERIC,
    (v_totals->>'total')::INT,
    v_coupon_id
  )
  RETURNING id INTO v_order_id;

  -- 6. Insert order_item — uno por entrada en perItem
  FOR v_perItem IN SELECT * FROM jsonb_array_elements(v_totals->'perItem')
  LOOP
    INSERT INTO order_item (
      order_id, product_id, variant_id, artisan_id,
      quantity, unit_price, total_price, snapshot_title
    ) VALUES (
      v_order_id,
      (v_perItem->>'productId')::UUID,
      (v_perItem->>'variantId')::UUID,
      (v_perItem->>'artisanId')::UUID,
      (v_perItem->>'qty')::INT,
      (v_perItem->>'unitPrice')::INT,
      (v_perItem->>'totalPrice')::INT,
      v_perItem->>'snapshotTitle'
    );
  END LOOP;

  -- 7. Insert shipping_address
  v_addr := v_payload->'address';
  INSERT INTO shipping_address (
    order_id, full_name, address_line1, address_line2,
    city, state_province, country_code, postal_code, phone
  ) VALUES (
    v_order_id,
    v_addr->>'fullName',
    v_addr->>'line1',
    NULLIF(v_addr->>'line2', ''),
    v_addr->>'city',
    v_addr->>'region',
    v_addr->>'countryCode',
    NULLIF(v_addr->>'postalCode', ''),
    NULLIF(v_addr->>'phone', '')
  );

  -- 8. Insert shipment — uno por artesano. Persistimos courier literal
  -- (CR-04: 'flat_rate' ya es valido en el constraint vía migracion 022).
  FOR v_shipment IN SELECT * FROM jsonb_array_elements(v_payload->'shipments')
  LOOP
    INSERT INTO shipment (order_id, artisan_id, courier, status)
    VALUES (
      v_order_id,
      (v_shipment->>'artisanId')::UUID,
      v_shipment->>'courier',
      'pending'
    );
  END LOOP;

  -- 9. Calcular total_artisan_net desde perArtisan
  SELECT COALESCE(SUM((elem->>'artisanNet')::INT), 0)
    INTO v_total_artisan_net
    FROM jsonb_array_elements(v_totals->'perArtisan') AS elem;

  -- Insert payment (D-SPLIT: stripe_transfer_id=null, method=stripe)
  INSERT INTO payment (
    order_id, method, stripe_payment_intent_id, stripe_transfer_id,
    amount, artisan_net, commission_amount, status, paid_at
  ) VALUES (
    v_order_id,
    'stripe',
    p_pi_id,
    NULL,
    (v_totals->>'total')::INT,
    v_total_artisan_net,
    (v_totals->>'commission')::INT,
    'paid',
    now()
  );

  -- 10. Insert artisan_payout — uno por entrada en ledger
  FOR v_payout IN SELECT * FROM jsonb_array_elements(v_totals->'ledger')
  LOOP
    INSERT INTO artisan_payout (
      artisan_id, period_from, period_to,
      gross_amount, commission_amount, net_amount,
      stripe_payout_id, stripe_transfer_ids, status, notes
    ) VALUES (
      (v_payout->>'artisanId')::UUID,
      v_today,
      v_today,
      (v_payout->>'gross')::INT,
      (v_payout->>'commissionGross')::INT,
      (v_payout->>'netToArtisan')::INT,
      NULL,
      NULL,
      'pending',
      'order:' || v_order_id::TEXT
    );
  END LOOP;

  -- 11. Transition order: pending_payment -> paid
  PERFORM transition_order_status(v_order_id, 'paid', NULL);

  RETURN QUERY SELECT v_order_id, NULL::TEXT;
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN
    -- Errores controlados (ej. COUPON_LIMIT_REACHED). plpgsql revierte
    -- toda la transaccion automaticamente. Reraise para que el caller
    -- detecte el codigo via SQLERRM.
    RAISE;
END;
$$;

COMMENT ON FUNCTION create_order_from_snapshot(UUID, TEXT, JSONB) IS
  'Phase 3 CR-01 + CR-02: crea order completa (stock decrement + order/items/shipment/payment/payout + coupon increment + transition) atomicamente. Reemplaza la secuencia no transaccional de TS. Retorna (order_id, error_code) — error_code=NULL en exito.';
