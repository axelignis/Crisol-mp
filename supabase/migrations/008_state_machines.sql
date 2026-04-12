-- ============================================================
-- CRISOL -- Migracion 008: State machine functions
-- Transiciones estrictas con row locks (FOR UPDATE).
-- ============================================================

-- ------------------------------------------------------------
-- transition_product_status
-- Transiciones validas:
--   draft -> pending_review
--   pending_review -> published, changes_requested, rejected
--   changes_requested -> pending_review
--   rejected -> draft
--   published -> sold
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION transition_product_status(
  p_product_id UUID,
  p_new_status TEXT,
  p_actor_id   UUID,
  p_notes      TEXT DEFAULT NULL
)
RETURNS product
LANGUAGE plpgsql AS $$
DECLARE
  v_product product;
  v_valid   BOOLEAN := false;
BEGIN
  -- Row lock to prevent concurrent transitions
  SELECT * INTO v_product
  FROM product
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Validate transition
  v_valid := CASE v_product.status
    WHEN 'draft'              THEN p_new_status IN ('pending_review')
    WHEN 'pending_review'     THEN p_new_status IN ('published', 'changes_requested', 'rejected')
    WHEN 'changes_requested'  THEN p_new_status IN ('pending_review')
    WHEN 'rejected'           THEN p_new_status IN ('draft')
    WHEN 'published'          THEN p_new_status IN ('sold')
    ELSE false
  END;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'Invalid transition: % -> % for product %',
      v_product.status, p_new_status, p_product_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Apply transition with side effects
  UPDATE product SET
    status          = p_new_status,
    rejection_notes = CASE
      WHEN p_new_status IN ('changes_requested', 'rejected') THEN p_notes
      ELSE rejection_notes
    END,
    approved_by     = CASE
      WHEN p_new_status = 'published' THEN p_actor_id
      ELSE approved_by
    END,
    approved_at     = CASE
      WHEN p_new_status = 'published' THEN now()
      ELSE approved_at
    END,
    published_at    = CASE
      WHEN p_new_status = 'published' THEN now()
      ELSE published_at
    END,
    updated_at      = now()
  WHERE id = p_product_id
  RETURNING * INTO v_product;

  RETURN v_product;
END;
$$;

COMMENT ON FUNCTION transition_product_status IS 'Transicion estricta de estado de producto con row lock. ERRCODE P0001 = transicion invalida, P0002 = no encontrado.';

-- ------------------------------------------------------------
-- transition_order_status
-- Transiciones validas:
--   pending_payment -> paid, cancelled
--   paid -> in_preparation, cancelled
--   in_preparation -> shipped
--   shipped -> delivered
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION transition_order_status(
  p_order_id   UUID,
  p_new_status TEXT,
  p_actor_id   UUID
)
RETURNS "order"
LANGUAGE plpgsql AS $$
DECLARE
  v_order "order";
  v_valid BOOLEAN := false;
BEGIN
  -- Row lock to prevent concurrent transitions
  SELECT * INTO v_order
  FROM "order"
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Validate transition
  v_valid := CASE v_order.status
    WHEN 'pending_payment'  THEN p_new_status IN ('paid', 'cancelled')
    WHEN 'paid'             THEN p_new_status IN ('in_preparation', 'cancelled')
    WHEN 'in_preparation'   THEN p_new_status IN ('shipped')
    WHEN 'shipped'          THEN p_new_status IN ('delivered')
    ELSE false
  END;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'Invalid transition: % -> % for order %',
      v_order.status, p_new_status, p_order_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Apply transition
  UPDATE "order" SET
    status     = p_new_status,
    updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

COMMENT ON FUNCTION transition_order_status IS 'Transicion estricta de estado de pedido con row lock. ERRCODE P0001 = transicion invalida, P0002 = no encontrado.';
