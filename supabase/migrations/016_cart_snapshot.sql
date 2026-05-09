-- ============================================================
-- CRISOL — Migracion 016: cart_snapshot
-- Staging server-side del carrito para referenciarlo desde
-- PaymentIntent.metadata.cart_snapshot_id (Stripe metadata
-- limita a 500 chars/key, 50 keys — no se puede inlinear).
-- El webhook lee este snapshot para reconstruir order/order_item
-- de forma transaccional.
-- ============================================================

CREATE TABLE cart_snapshot (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload     JSONB NOT NULL,
  totals      JSONB NOT NULL,
  email       TEXT,
  buyer_id    UUID REFERENCES "user"(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes')
);

COMMENT ON TABLE  cart_snapshot            IS 'Staging del carrito al crear PaymentIntent. Webhook reconstruye order desde aqui. TTL 30 min — cleanup cron diferido a Phase 5.';
COMMENT ON COLUMN cart_snapshot.payload    IS 'JSON con items {variantId, productId, artisanId, qty} + address + couponCode + per-artisan shipping selections.';
COMMENT ON COLUMN cart_snapshot.totals     IS 'Snapshot canonico de totales calculados server-side (subtotal, discount, shipping, commission, total). Inmutable.';
COMMENT ON COLUMN cart_snapshot.expires_at IS 'PI metadata reference invalida tras este timestamp. Webhook debe revalidar.';

CREATE INDEX cart_snapshot_expires_at_idx ON cart_snapshot (expires_at);

-- RLS: deny-all a anon/authenticated. Solo service_role puede leer/escribir
-- (PI creation endpoint y webhook handler). El payload contiene precios
-- canonicos que el cliente NUNCA debe poder leer ni alterar.
ALTER TABLE cart_snapshot ENABLE ROW LEVEL SECURITY;

-- Policies explicitamente vacias: sin policies + RLS habilitado = deny all
-- a roles publicos. service_role bypassea RLS por defecto.
-- (No definimos policies permisivas a proposito.)
