-- ============================================================
-- CRISOL -- Migracion 005: Comercio
-- Pedidos, items, pagos (Stripe Connect), despachos, direcciones.
-- Montos en INTEGER (CLP canonico).
-- ============================================================

-- ------------------------------------------------------------
-- ORDER -- pedido
-- ------------------------------------------------------------
CREATE TABLE "order" (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id                UUID REFERENCES buyer(id),
  guest_email             TEXT,
  guest_name              TEXT,
  status                  TEXT NOT NULL DEFAULT 'pending_payment'
                            CHECK (status IN (
                              'pending_payment',
                              'paid',
                              'in_preparation',
                              'shipped',
                              'delivered',
                              'cancelled'
                            )),
  subtotal                INTEGER NOT NULL CHECK (subtotal >= 0),
  shipping_cost           INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  discount_amount         INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  commission_amount       INTEGER NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
  commission_pct_snapshot NUMERIC(5,2),   -- tasa de comision vigente al momento del pago
  total                   INTEGER NOT NULL CHECK (total >= 0),
  points_redeemed         INTEGER NOT NULL DEFAULT 0 CHECK (points_redeemed >= 0),
  coupon_id               UUID REFERENCES coupon(id),
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT buyer_or_guest CHECK (
    buyer_id IS NOT NULL OR guest_email IS NOT NULL
  )
);

COMMENT ON TABLE  "order"                        IS 'Pedido. Montos en CLP (INTEGER). Disponible para compradores registrados e invitados.';
COMMENT ON COLUMN "order".status                 IS 'pending_payment -> paid -> in_preparation -> shipped -> delivered (+cancelled)';
COMMENT ON COLUMN "order".commission_amount       IS 'Monto de comision del admin en CLP, calculado al momento del pago.';
COMMENT ON COLUMN "order".commission_pct_snapshot IS 'Porcentaje de comision vigente al momento del pago. Snapshot para auditoria.';

CREATE TRIGGER tg_order_updated_at
  BEFORE UPDATE ON "order"
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ------------------------------------------------------------
-- ORDER_ITEM -- linea del pedido
-- ------------------------------------------------------------
CREATE TABLE order_item (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  product_id          UUID REFERENCES product(id),
  variant_id          UUID REFERENCES product_variant(id),
  commission_slot_id  UUID REFERENCES commission_slot(id),
  artisan_id          UUID NOT NULL REFERENCES artisan(id),
  quantity            INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price          INTEGER NOT NULL CHECK (unit_price >= 0),
  total_price         INTEGER NOT NULL CHECK (total_price >= 0),
  snapshot_title      TEXT NOT NULL,
  snapshot_sku        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_or_slot CHECK (
    (product_id IS NOT NULL AND commission_slot_id IS NULL) OR
    (product_id IS NULL AND commission_slot_id IS NOT NULL)
  )
);

COMMENT ON TABLE  order_item               IS 'Linea de un pedido. Precios en CLP (INTEGER). snapshot_title es inmutable post-venta.';
COMMENT ON COLUMN order_item.artisan_id    IS 'Desnormalizado para facilitar queries por artesano sin joins adicionales.';

-- ------------------------------------------------------------
-- PAYMENT -- pago via Stripe Connect
-- ------------------------------------------------------------
CREATE TABLE payment (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                    UUID UNIQUE NOT NULL REFERENCES "order"(id),
  method                      TEXT NOT NULL CHECK (method IN ('stripe', 'crypto')),
  stripe_payment_intent_id    TEXT,     -- pi_... Payment Intent
  stripe_transfer_id          TEXT,     -- tr_... Connect transfer to artisan
  coinbase_charge_id          TEXT,
  amount                      INTEGER NOT NULL CHECK (amount > 0),
  artisan_net                 INTEGER NOT NULL CHECK (artisan_net >= 0),
  commission_amount           INTEGER NOT NULL CHECK (commission_amount >= 0),
  status                      TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded')),
  paid_at                     TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  payment                          IS 'Pago via Stripe Connect. Montos en CLP (INTEGER).';
COMMENT ON COLUMN payment.stripe_payment_intent_id IS 'Payment Intent ID (pi_...).';
COMMENT ON COLUMN payment.stripe_transfer_id       IS 'Stripe Connect Transfer ID (tr_...) al artesano.';
COMMENT ON COLUMN payment.artisan_net              IS 'Monto neto que recibe el artesano via Stripe Connect.';

CREATE TRIGGER tg_payment_updated_at
  BEFORE UPDATE ON payment
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ------------------------------------------------------------
-- ARTISAN_PAYOUT -- liquidaciones via Stripe Connect
-- ------------------------------------------------------------
CREATE TABLE artisan_payout (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id            UUID NOT NULL REFERENCES artisan(id),
  period_from           DATE NOT NULL,
  period_to             DATE NOT NULL,
  gross_amount          INTEGER NOT NULL,
  commission_amount     INTEGER NOT NULL,
  net_amount            INTEGER NOT NULL,
  stripe_payout_id      TEXT,              -- Stripe payout ID (po_...)
  stripe_transfer_ids   JSONB,             -- array de transfer IDs en este payout
  notes                 TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'paid')),
  paid_at               TIMESTAMPTZ,
  paid_by               UUID REFERENCES "user"(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  artisan_payout                IS 'Liquidaciones via Stripe Connect. Montos en CLP (INTEGER).';
COMMENT ON COLUMN artisan_payout.stripe_payout_id   IS 'Stripe Payout ID (po_...).';
COMMENT ON COLUMN artisan_payout.stripe_transfer_ids IS 'Array JSON de Transfer IDs incluidos en este payout.';
COMMENT ON COLUMN artisan_payout.status         IS 'pending = en proceso | paid = transferencia completada.';

CREATE TRIGGER tg_artisan_payout_updated_at
  BEFORE UPDATE ON artisan_payout
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ------------------------------------------------------------
-- SHIPMENT -- despacho por artesano
-- ------------------------------------------------------------
CREATE TABLE shipment (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES "order"(id),
  artisan_id        UUID NOT NULL REFERENCES artisan(id),
  courier           TEXT NOT NULL CHECK (courier IN ('chilexpress', 'starken', 'dhl', 'fedex', 'pickup')),
  tracking_number   TEXT,
  tracking_url      TEXT,
  estimated_delivery DATE,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'preparing', 'dispatched', 'in_transit', 'delivered', 'failed')),
  shipped_at        TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  shipment         IS 'Despacho de pedido. Cada artesano gestiona el envio de sus propias piezas.';
COMMENT ON COLUMN shipment.courier IS 'chilexpress | starken = nacional | dhl | fedex = internacional | pickup = retiro.';

CREATE TRIGGER tg_shipment_updated_at
  BEFORE UPDATE ON shipment
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ------------------------------------------------------------
-- SHIPPING_ADDRESS -- direccion inmutable del pedido
-- ------------------------------------------------------------
CREATE TABLE shipping_address (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID UNIQUE NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  full_name      TEXT NOT NULL,
  address_line1  TEXT NOT NULL,
  address_line2  TEXT,
  city           TEXT NOT NULL,
  state_province TEXT,
  country_code   TEXT NOT NULL DEFAULT 'CL',
  postal_code    TEXT,
  phone          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE shipping_address IS 'Direccion de envio snapshot al confirmar el pedido. Inmutable post-creacion.';
