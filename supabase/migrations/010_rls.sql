-- ============================================================
-- CRISOL -- Migracion 010: Row Level Security
-- RLS en todas las tablas con public.user_role() basado en JWT.
-- ============================================================

-- ------------------------------------------------------------
-- Helper functions para RLS
-- ------------------------------------------------------------

-- Rol del usuario desde JWT claim (NO desde DB query)
-- En schema public porque Supabase no permite DDL en auth schema
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'user_role'),
    'buyer'
  );
$$ LANGUAGE sql STABLE;

-- Artisan ID del usuario actual (necesita DB lookup para ownership)
CREATE OR REPLACE FUNCTION current_artisan_id()
RETURNS UUID AS $$
  SELECT id FROM artisan WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Buyer ID del usuario actual (necesita DB lookup para ownership)
CREATE OR REPLACE FUNCTION current_buyer_id()
RETURNS UUID AS $$
  SELECT id FROM buyer WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Habilitar RLS en TODAS las tablas
-- ============================================================
ALTER TABLE "user"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE artisan              ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer                ENABLE ROW LEVEL SECURITY;
ALTER TABLE product              ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variant      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media        ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tag          ENABLE ROW LEVEL SECURITY;
ALTER TABLE category             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_slot      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment              ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_address     ENABLE ROW LEVEL SECURITY;
ALTER TABLE artisan_payout       ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon               ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_level     ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transaction  ENABLE ROW LEVEL SECURITY;
ALTER TABLE review               ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_item        ENABLE ROW LEVEL SECURITY;
ALTER TABLE artisan_follower     ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post            ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_meta             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification         ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_event        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES
-- ============================================================

-- ------------------------------------------------------------
-- USER
-- ------------------------------------------------------------
CREATE POLICY "user: ver propio perfil"
  ON "user" FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "user: editar propio perfil"
  ON "user" FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "admin: gestionar todos los usuarios"
  ON "user" FOR ALL
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- ARTISAN
-- ------------------------------------------------------------
CREATE POLICY "artisan: perfil publico visible para todos"
  ON artisan FOR SELECT
  USING (true);

CREATE POLICY "artisan: editar propio perfil"
  ON artisan FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "admin: gestionar artesanos"
  ON artisan FOR ALL
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- BUYER
-- ------------------------------------------------------------
CREATE POLICY "buyer: ver propio perfil"
  ON buyer FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "buyer: editar propio perfil"
  ON buyer FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "admin: ver todos los compradores"
  ON buyer FOR SELECT
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- PRODUCT
-- ------------------------------------------------------------
CREATE POLICY "product: publicados visibles para todos"
  ON product FOR SELECT
  USING (status IN ('published', 'sold'));

CREATE POLICY "artisan: ver propias piezas (todos los estados)"
  ON product FOR SELECT
  USING (artisan_id = current_artisan_id());

CREATE POLICY "artisan: crear piezas propias"
  ON product FOR INSERT
  WITH CHECK (artisan_id = current_artisan_id());

CREATE POLICY "artisan: editar piezas propias"
  ON product FOR UPDATE
  USING (artisan_id = current_artisan_id());

CREATE POLICY "admin: gestionar todas las piezas"
  ON product FOR ALL
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- PRODUCT_VARIANT
-- ------------------------------------------------------------
CREATE POLICY "variant: visible si producto publicado"
  ON product_variant FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM product p
    WHERE p.id = product_id AND p.status IN ('published', 'sold')
  ));

CREATE POLICY "artisan: gestionar variantes de sus piezas"
  ON product_variant FOR ALL
  USING (EXISTS (
    SELECT 1 FROM product p
    WHERE p.id = product_id AND p.artisan_id = current_artisan_id()
  ));

CREATE POLICY "admin: gestionar todas las variantes"
  ON product_variant FOR ALL
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- PRODUCT_MEDIA
-- ------------------------------------------------------------
CREATE POLICY "media: visible si producto publicado"
  ON product_media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM product p
    WHERE p.id = product_id AND p.status IN ('published', 'sold')
  ));

CREATE POLICY "artisan: gestionar media de sus piezas"
  ON product_media FOR ALL
  USING (EXISTS (
    SELECT 1 FROM product p
    WHERE p.id = product_id AND p.artisan_id = current_artisan_id()
  ));

CREATE POLICY "admin: gestionar todo el media"
  ON product_media FOR ALL
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- CATEGORIAS Y TAGS -- lectura publica, escritura solo admin
-- ------------------------------------------------------------
CREATE POLICY "category: lectura publica"          ON category FOR SELECT USING (true);
CREATE POLICY "admin: gestionar categorias"        ON category FOR ALL   USING (public.user_role() = 'admin');
CREATE POLICY "tag: lectura publica"               ON tag      FOR SELECT USING (true);
CREATE POLICY "admin: gestionar tags"              ON tag      FOR ALL   USING (public.user_role() = 'admin');
CREATE POLICY "product_tag: lectura publica"       ON product_tag FOR SELECT USING (true);
CREATE POLICY "artisan: gestionar tags de sus piezas"
  ON product_tag FOR ALL
  USING (EXISTS (
    SELECT 1 FROM product p
    WHERE p.id = product_id AND p.artisan_id = current_artisan_id()
  ));

-- ------------------------------------------------------------
-- COMMISSION_SLOT
-- ------------------------------------------------------------
CREATE POLICY "slot: disponibles visibles para todos"
  ON commission_slot FOR SELECT
  USING (is_available = true);

CREATE POLICY "artisan: gestionar propios slots"
  ON commission_slot FOR ALL
  USING (artisan_id = current_artisan_id());

CREATE POLICY "admin: gestionar todos los slots"
  ON commission_slot FOR ALL
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- ORDER
-- ------------------------------------------------------------
CREATE POLICY "order: comprador ve sus pedidos"
  ON "order" FOR SELECT
  USING (buyer_id = current_buyer_id());

CREATE POLICY "order: artesano ve pedidos con sus items"
  ON "order" FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM order_item oi
    WHERE oi.order_id = id AND oi.artisan_id = current_artisan_id()
  ));

CREATE POLICY "order: comprador puede crear su propio pedido"
  ON "order" FOR INSERT
  WITH CHECK (buyer_id = current_buyer_id());

CREATE POLICY "admin: gestionar todos los pedidos"
  ON "order" FOR ALL
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- ORDER_ITEM
-- ------------------------------------------------------------
CREATE POLICY "item: comprador ve items de sus pedidos"
  ON order_item FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "order" o
    WHERE o.id = order_id AND o.buyer_id = current_buyer_id()
  ));

CREATE POLICY "item: artesano ve sus propios items"
  ON order_item FOR SELECT
  USING (artisan_id = current_artisan_id());

CREATE POLICY "item: solo via pedido del comprador"
  ON order_item FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM "order" o
    WHERE o.id = order_id AND o.buyer_id = current_buyer_id()
  ));

CREATE POLICY "admin: gestionar todos los items"
  ON order_item FOR ALL
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- PAYMENT
-- ------------------------------------------------------------
CREATE POLICY "payment: comprador ve sus pagos"
  ON payment FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "order" o
    WHERE o.id = order_id AND o.buyer_id = current_buyer_id()
  ));

CREATE POLICY "payment: artesano ve pagos de sus pedidos"
  ON payment FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM order_item oi
    WHERE oi.order_id = order_id AND oi.artisan_id = current_artisan_id()
  ));

CREATE POLICY "admin: gestionar todos los pagos"
  ON payment FOR ALL
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- SHIPMENT
-- ------------------------------------------------------------
CREATE POLICY "shipment: comprador ve sus envios"
  ON shipment FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "order" o
    WHERE o.id = order_id AND o.buyer_id = current_buyer_id()
  ));

CREATE POLICY "artisan: gestionar propios envios"
  ON shipment FOR ALL
  USING (artisan_id = current_artisan_id());

CREATE POLICY "admin: gestionar todos los envios"
  ON shipment FOR ALL
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- SHIPPING_ADDRESS
-- ------------------------------------------------------------
CREATE POLICY "address: comprador ve su direccion"
  ON shipping_address FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "order" o
    WHERE o.id = order_id AND o.buyer_id = current_buyer_id()
  ));

CREATE POLICY "address: solo en pedido del comprador"
  ON shipping_address FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM "order" o
    WHERE o.id = order_id AND o.buyer_id = current_buyer_id()
  ));

CREATE POLICY "admin: gestionar todas las direcciones"
  ON shipping_address FOR ALL
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- ARTISAN_PAYOUT
-- ------------------------------------------------------------
CREATE POLICY "payout: artesano ve sus propios payouts"
  ON artisan_payout FOR SELECT
  USING (artisan_id = current_artisan_id());

CREATE POLICY "admin: gestionar todos los payouts"
  ON artisan_payout FOR ALL
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- COUPON / COMMISSION_CONFIG / MEMBERSHIP_LEVEL
-- ------------------------------------------------------------
CREATE POLICY "coupon: activos visibles para todos"
  ON coupon FOR SELECT USING (is_active = true);
CREATE POLICY "admin: gestionar cupones"
  ON coupon FOR ALL USING (public.user_role() = 'admin');

CREATE POLICY "commission_config: lectura publica"
  ON commission_config FOR SELECT USING (true);
CREATE POLICY "admin: gestionar comision"
  ON commission_config FOR ALL USING (public.user_role() = 'admin');

CREATE POLICY "membership_level: lectura publica"
  ON membership_level FOR SELECT USING (true);
CREATE POLICY "admin: gestionar membresias"
  ON membership_level FOR ALL USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- LOYALTY_TRANSACTION
-- ------------------------------------------------------------
CREATE POLICY "loyalty: comprador ve sus transacciones"
  ON loyalty_transaction FOR SELECT
  USING (buyer_id = current_buyer_id());

CREATE POLICY "admin: gestionar todas las transacciones"
  ON loyalty_transaction FOR ALL
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- REVIEW
-- ------------------------------------------------------------
CREATE POLICY "review: aprobadas visibles para todos"
  ON review FOR SELECT
  USING (is_approved = true);

CREATE POLICY "review: comprador ve sus propias resenas"
  ON review FOR SELECT
  USING (buyer_id = current_buyer_id());

CREATE POLICY "review: comprador puede crear resena de pedido entregado"
  ON review FOR INSERT
  WITH CHECK (
    buyer_id = current_buyer_id() AND
    EXISTS (
      SELECT 1 FROM "order" o
      WHERE o.id = order_id
        AND o.buyer_id = current_buyer_id()
        AND o.status = 'delivered'
    )
  );

CREATE POLICY "admin: moderar resenas"
  ON review FOR ALL
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- WISHLIST / FOLLOWER
-- ------------------------------------------------------------
CREATE POLICY "wishlist: comprador gestiona su lista"
  ON wishlist_item FOR ALL
  USING (buyer_id = current_buyer_id());

CREATE POLICY "follower: lectura publica"
  ON artisan_follower FOR SELECT USING (true);

CREATE POLICY "follower: comprador gestiona sus seguidos"
  ON artisan_follower FOR ALL
  USING (buyer_id = current_buyer_id());

-- ------------------------------------------------------------
-- BLOG / SEO_META
-- ------------------------------------------------------------
CREATE POLICY "blog: posts publicados visibles para todos"
  ON blog_post FOR SELECT
  USING (status = 'published');

CREATE POLICY "admin: gestionar blog"
  ON blog_post FOR ALL
  USING (public.user_role() = 'admin');

CREATE POLICY "seo_meta: lectura publica"
  ON seo_meta FOR SELECT USING (true);

CREATE POLICY "admin: gestionar seo_meta"
  ON seo_meta FOR ALL
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- NOTIFICATION
-- ------------------------------------------------------------
CREATE POLICY "notif: usuario ve sus notificaciones"
  ON notification FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notif: usuario puede marcar como leida"
  ON notification FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "admin: gestionar todas las notificaciones"
  ON notification FOR ALL
  USING (public.user_role() = 'admin');

-- ------------------------------------------------------------
-- WEBHOOK_EVENT -- solo admin
-- ------------------------------------------------------------
CREATE POLICY "webhook_event: admin only"
  ON webhook_event FOR ALL
  USING (public.user_role() = 'admin');
