-- ============================================================
-- CRISOL — Migración 005: Comercio
-- Pedidos, ítems, pagos, despachos y direcciones de envío.
-- ============================================================

-- ------------------------------------------------------------
-- ORDER — pedido
-- ------------------------------------------------------------
CREATE TABLE "order" (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id          UUID REFERENCES buyer(id),       -- NULL si compra como invitado
  guest_email       TEXT,
  guest_name        TEXT,
  status            TEXT NOT NULL DEFAULT 'pending_payment'
                      CHECK (status IN (
                        'pending_payment',
                        'paid',
                        'in_preparation',
                        'shipped',
                        'delivered',
                        'cancelled'
                      )),
  subtotal          NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  shipping_cost     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  discount_amount   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
  total             NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  currency          TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
  points_redeemed   INTEGER NOT NULL DEFAULT 0 CHECK (points_redeemed >= 0),
  coupon_id         UUID REFERENCES coupon(id),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT buyer_or_guest CHECK (
    buyer_id IS NOT NULL OR guest_email IS NOT NULL
  )
);

COMMENT ON TABLE  "order"                  IS 'Pedido. Disponible para compradores registrados e invitados (guest_email).';
COMMENT ON COLUMN "order".status           IS 'pending_payment → paid → in_preparation → shipped → delivered';
COMMENT ON COLUMN "order".commission_amount IS 'Monto de comisión del admin, calculado al momento del pago.';
COMMENT ON COLUMN "order".points_redeemed  IS 'Puntos canjeados como descuento en este pedido.';

-- ------------------------------------------------------------
-- ORDER_ITEM — línea del pedido
-- ------------------------------------------------------------
CREATE TABLE order_item (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  product_id          UUID REFERENCES product(id),
  variant_id          UUID REFERENCES product_variant(id),
  commission_slot_id  UUID REFERENCES commission_slot(id),
  artisan_id          UUID NOT NULL REFERENCES artisan(id),
  quantity            INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price          NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  total_price         NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
  snapshot_title      TEXT NOT NULL,  -- copia inmutable del título al momento de la compra
  snapshot_sku        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_or_slot CHECK (
    (product_id IS NOT NULL AND commission_slot_id IS NULL) OR
    (product_id IS NULL AND commission_slot_id IS NOT NULL)
  )
);

COMMENT ON TABLE  order_item               IS 'Línea de un pedido. snapshot_title es inmutable post-venta.';
COMMENT ON COLUMN order_item.snapshot_title IS 'Título del producto al momento de la compra. No cambia si el artesano edita la pieza.';
COMMENT ON COLUMN order_item.artisan_id    IS 'Desnormalizado para facilitar queries por artesano sin joins adicionales.';

-- ------------------------------------------------------------
-- PAYMENT — registro del pago del comprador al admin
--
-- MODELO: El admin recibe el pago completo en su cuenta
-- Stripe personal. La comisión queda en la cuenta del admin.
-- El neto del artesano se registra aquí para saber cuánto
-- transferirle, pero la transferencia es manual (ver ARTISAN_PAYOUT).
-- ------------------------------------------------------------
CREATE TABLE payment (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                    UUID UNIQUE NOT NULL REFERENCES "order"(id),
  method                      TEXT NOT NULL CHECK (method IN ('stripe', 'crypto', 'bank_transfer')),
  stripe_payment_intent_id    TEXT,   -- pi_... Cobro del comprador al admin
  coinbase_charge_id          TEXT,
  amount                      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  artisan_net                 NUMERIC(10,2) NOT NULL CHECK (artisan_net >= 0),
  commission_amount           NUMERIC(10,2) NOT NULL CHECK (commission_amount >= 0),
  currency                    TEXT NOT NULL DEFAULT 'CLP',
  status                      TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded')),
  paid_at                     TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  payment                          IS 'Pago del comprador a la cuenta Stripe del admin. El neto del artesano se transfiere manualmente via ARTISAN_PAYOUT.';
COMMENT ON COLUMN payment.stripe_payment_intent_id IS 'Payment Intent ID (pi_...) de la cuenta Stripe personal del admin.';
COMMENT ON COLUMN payment.artisan_net              IS 'Monto que el admin le debe al artesano. Se liquida con ARTISAN_PAYOUT.';
COMMENT ON COLUMN payment.commission_amount        IS 'Monto que queda en la cuenta del admin como comisión.';

-- ------------------------------------------------------------
-- ARTISAN_PAYOUT — liquidaciones manuales a artesanos
--
-- El admin marca aquí cada transferencia bancaria realizada
-- a un artesano. Puede agrupar múltiples ventas en un solo
-- pago (liquidación semanal, quincenal, mensual).
-- ------------------------------------------------------------
CREATE TABLE artisan_payout (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id        UUID NOT NULL REFERENCES artisan(id),
  period_from       DATE NOT NULL,           -- inicio del período liquidado
  period_to         DATE NOT NULL,           -- fin del período liquidado
  gross_amount      NUMERIC(10,2) NOT NULL,  -- ventas brutas del período
  commission_amount NUMERIC(10,2) NOT NULL,  -- comisión descontada
  net_amount        NUMERIC(10,2) NOT NULL,  -- monto transferido al artesano
  currency          TEXT NOT NULL DEFAULT 'CLP',
  -- Datos de la transferencia bancaria manual
  transfer_date     DATE,
  transfer_ref      TEXT,                    -- número de transferencia o comprobante
  transfer_bank     TEXT,                    -- banco desde el que se envió
  notes             TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid')),
  paid_at           TIMESTAMPTZ,
  paid_by           UUID REFERENCES "user"(id),  -- admin que marcó como pagado
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  artisan_payout            IS 'Liquidaciones manuales del admin a cada artesano. Agrupa ventas de un período.';
COMMENT ON COLUMN artisan_payout.transfer_ref IS 'Número de comprobante de transferencia bancaria. Evidencia del pago.';
COMMENT ON COLUMN artisan_payout.status     IS 'pending = monto adeudado al artesano · paid = transferencia realizada y confirmada.';

-- ------------------------------------------------------------
-- SHIPMENT — despacho por artesano
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

COMMENT ON TABLE  shipment         IS 'Despacho de pedido. Cada artesano gestiona el envío de sus propias piezas.';
COMMENT ON COLUMN shipment.courier IS 'chilexpress | starken = nacional · dhl | fedex = internacional · pickup = retiro en persona.';

-- ------------------------------------------------------------
-- SHIPPING_ADDRESS — dirección inmutable del pedido
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

COMMENT ON TABLE shipping_address IS 'Dirección de envío snapshot al confirmar el pedido. Inmutable post-creación.';