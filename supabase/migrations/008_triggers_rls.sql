-- ============================================================
-- CRISOL — Migración 008: Triggers, funciones y políticas RLS
-- Automatización y seguridad a nivel de base de datos.
-- ============================================================

-- ============================================================
-- SECCIÓN A: FUNCIONES Y TRIGGERS
-- ============================================================

-- ------------------------------------------------------------
-- A1. updated_at automático
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas con updated_at
CREATE TRIGGER tg_user_updated_at
  BEFORE UPDATE ON "user"
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER tg_artisan_updated_at
  BEFORE UPDATE ON artisan
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER tg_buyer_updated_at
  BEFORE UPDATE ON buyer
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER tg_product_updated_at
  BEFORE UPDATE ON product
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER tg_commission_slot_updated_at
  BEFORE UPDATE ON commission_slot
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER tg_order_updated_at
  BEFORE UPDATE ON "order"
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER tg_payment_updated_at
  BEFORE UPDATE ON payment
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER tg_shipment_updated_at
  BEFORE UPDATE ON shipment
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER tg_blog_updated_at
  BEFORE UPDATE ON blog_post
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ------------------------------------------------------------
-- A2. Auto-crear perfil USER al registrarse en Supabase Auth
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "user" (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_handle_new_auth_user();

-- ------------------------------------------------------------
-- A3. Auto-crear perfil BUYER al crear usuario con role = buyer
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_create_buyer_profile()
RETURNS TRIGGER AS $$
DECLARE
  default_level_id UUID;
BEGIN
  IF NEW.role = 'buyer' THEN
    SELECT id INTO default_level_id
    FROM membership_level
    ORDER BY sort_order ASC
    LIMIT 1;

    INSERT INTO buyer (user_id, membership_level_id)
    VALUES (NEW.id, default_level_id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tg_create_buyer_profile
  AFTER INSERT ON "user"
  FOR EACH ROW EXECUTE FUNCTION fn_create_buyer_profile();

-- ------------------------------------------------------------
-- A4. Auto-crear perfil ARTISAN al crear usuario con role = artisan
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_create_artisan_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'artisan' THEN
    INSERT INTO artisan (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tg_create_artisan_profile
  AFTER INSERT ON "user"
  FOR EACH ROW EXECUTE FUNCTION fn_create_artisan_profile();

-- ------------------------------------------------------------
-- A5. Sincronizar total_points del buyer con cada transacción
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_buyer_points()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE buyer
  SET total_points = NEW.balance_after
  WHERE id = NEW.buyer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_sync_buyer_points
  AFTER INSERT ON loyalty_transaction
  FOR EACH ROW EXECUTE FUNCTION fn_sync_buyer_points();

-- ------------------------------------------------------------
-- A6. Verificar y actualizar nivel de membresía automáticamente
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_check_membership_upgrade()
RETURNS TRIGGER AS $$
DECLARE
  new_level_id UUID;
BEGIN
  IF NEW.total_points IS DISTINCT FROM OLD.total_points THEN
    SELECT id INTO new_level_id
    FROM membership_level
    WHERE points_threshold <= NEW.total_points
    ORDER BY points_threshold DESC
    LIMIT 1;

    IF new_level_id IS NOT NULL AND new_level_id IS DISTINCT FROM NEW.membership_level_id THEN
      NEW.membership_level_id := new_level_id;
      NEW.level_since := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_check_membership_upgrade
  BEFORE UPDATE OF total_points ON buyer
  FOR EACH ROW EXECUTE FUNCTION fn_check_membership_upgrade();

-- ------------------------------------------------------------
-- A7. Marcar producto como 'sold' al agotar stock (piezas únicas)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_check_product_sold()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock = 0 THEN
    UPDATE product
    SET status = 'sold'
    WHERE id = NEW.product_id
      AND is_unique = true
      AND status = 'published';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_check_product_sold
  AFTER UPDATE OF stock ON product_variant
  FOR EACH ROW EXECUTE FUNCTION fn_check_product_sold();


-- ============================================================
-- SECCIÓN B: FUNCIONES HELPER PARA RLS
-- ============================================================

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM "user" WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION current_artisan_id()
RETURNS UUID AS $$
  SELECT id FROM artisan WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION current_buyer_id()
RETURNS UUID AS $$
  SELECT id FROM buyer WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- SECCIÓN C: ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE "user"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE artisan               ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE product               ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variant       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tag           ENABLE ROW LEVEL SECURITY;
ALTER TABLE category              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_slot       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment               ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment              ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_address      ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon                ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_level      ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transaction   ENABLE ROW LEVEL SECURITY;
ALTER TABLE review                ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_item         ENABLE ROW LEVEL SECURITY;
ALTER TABLE artisan_follower      ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post             ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_meta              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification          ENABLE ROW LEVEL SECURITY;

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
  USING (current_user_role() = 'admin');

-- ------------------------------------------------------------
-- ARTISAN
-- ------------------------------------------------------------
CREATE POLICY "artisan: perfil público visible para todos"
  ON artisan FOR SELECT
  USING (true);

CREATE POLICY "artisan: editar propio perfil"
  ON artisan FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "admin: gestionar artesanos"
  ON artisan FOR ALL
  USING (current_user_role() = 'admin');

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
  USING (current_user_role() = 'admin');

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
  USING (current_user_role() = 'admin');

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
  USING (current_user_role() = 'admin');

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
  USING (current_user_role() = 'admin');

-- ------------------------------------------------------------
-- CATEGORÍAS Y TAGS — lectura pública, escritura solo admin
-- ------------------------------------------------------------
CREATE POLICY "category: lectura pública"          ON category FOR SELECT USING (true);
CREATE POLICY "admin: gestionar categorías"         ON category FOR ALL   USING (current_user_role() = 'admin');
CREATE POLICY "tag: lectura pública"               ON tag      FOR SELECT USING (true);
CREATE POLICY "admin: gestionar tags"              ON tag      FOR ALL   USING (current_user_role() = 'admin');
CREATE POLICY "product_tag: lectura pública"       ON product_tag FOR SELECT USING (true);
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
  USING (current_user_role() = 'admin');

-- ------------------------------------------------------------
-- ORDER
-- ------------------------------------------------------------
CREATE POLICY "order: comprador ve sus pedidos"
  ON "order" FOR SELECT
  USING (buyer_id = current_buyer_id());

CREATE POLICY "order: artesano ve pedidos con sus ítems"
  ON "order" FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM order_item oi
    WHERE oi.order_id = id AND oi.artisan_id = current_artisan_id()
  ));

CREATE POLICY "order: cualquiera puede crear pedido"
  ON "order" FOR INSERT
  WITH CHECK (true);

CREATE POLICY "admin: gestionar todos los pedidos"
  ON "order" FOR ALL
  USING (current_user_role() = 'admin');

-- ------------------------------------------------------------
-- ORDER_ITEM
-- ------------------------------------------------------------
CREATE POLICY "item: comprador ve ítems de sus pedidos"
  ON order_item FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "order" o
    WHERE o.id = order_id AND o.buyer_id = current_buyer_id()
  ));

CREATE POLICY "item: artesano ve sus propios ítems"
  ON order_item FOR SELECT
  USING (artisan_id = current_artisan_id());

CREATE POLICY "item: cualquiera puede insertar"
  ON order_item FOR INSERT
  WITH CHECK (true);

CREATE POLICY "admin: gestionar todos los ítems"
  ON order_item FOR ALL
  USING (current_user_role() = 'admin');

-- ------------------------------------------------------------
-- PAYMENT — datos financieros sensibles
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
  USING (current_user_role() = 'admin');

-- ------------------------------------------------------------
-- SHIPMENT
-- ------------------------------------------------------------
CREATE POLICY "shipment: comprador ve sus envíos"
  ON shipment FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "order" o
    WHERE o.id = order_id AND o.buyer_id = current_buyer_id()
  ));

CREATE POLICY "artisan: gestionar propios envíos"
  ON shipment FOR ALL
  USING (artisan_id = current_artisan_id());

CREATE POLICY "admin: gestionar todos los envíos"
  ON shipment FOR ALL
  USING (current_user_role() = 'admin');

-- ------------------------------------------------------------
-- SHIPPING_ADDRESS
-- ------------------------------------------------------------
CREATE POLICY "address: comprador ve su dirección"
  ON shipping_address FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "order" o
    WHERE o.id = order_id AND o.buyer_id = current_buyer_id()
  ));

CREATE POLICY "address: cualquiera puede insertar"
  ON shipping_address FOR INSERT
  WITH CHECK (true);

CREATE POLICY "admin: gestionar todas las direcciones"
  ON shipping_address FOR ALL
  USING (current_user_role() = 'admin');

-- ------------------------------------------------------------
-- COUPON / COMMISSION_CONFIG / MEMBERSHIP_LEVEL — lectura pública
-- ------------------------------------------------------------
CREATE POLICY "coupon: activos visibles para todos"
  ON coupon FOR SELECT USING (is_active = true);
CREATE POLICY "admin: gestionar cupones"
  ON coupon FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "commission_config: lectura pública"
  ON commission_config FOR SELECT USING (true);
CREATE POLICY "admin: gestionar comisión"
  ON commission_config FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "membership_level: lectura pública"
  ON membership_level FOR SELECT USING (true);
CREATE POLICY "admin: gestionar membresías"
  ON membership_level FOR ALL USING (current_user_role() = 'admin');

-- ------------------------------------------------------------
-- LOYALTY_TRANSACTION
-- ------------------------------------------------------------
CREATE POLICY "loyalty: comprador ve sus transacciones"
  ON loyalty_transaction FOR SELECT
  USING (buyer_id = current_buyer_id());

CREATE POLICY "admin: gestionar todas las transacciones"
  ON loyalty_transaction FOR ALL
  USING (current_user_role() = 'admin');

-- ------------------------------------------------------------
-- REVIEW
-- ------------------------------------------------------------
CREATE POLICY "review: aprobadas visibles para todos"
  ON review FOR SELECT
  USING (is_approved = true);

CREATE POLICY "review: comprador ve sus propias reseñas"
  ON review FOR SELECT
  USING (buyer_id = current_buyer_id());

CREATE POLICY "review: comprador puede crear reseña de su pedido entregado"
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

CREATE POLICY "admin: moderar reseñas"
  ON review FOR ALL
  USING (current_user_role() = 'admin');

-- ------------------------------------------------------------
-- WISHLIST / FOLLOWER
-- ------------------------------------------------------------
CREATE POLICY "wishlist: comprador gestiona su lista"
  ON wishlist_item FOR ALL
  USING (buyer_id = current_buyer_id());

CREATE POLICY "follower: lectura pública"
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
  USING (current_user_role() = 'admin');

CREATE POLICY "seo_meta: lectura pública"
  ON seo_meta FOR SELECT USING (true);

CREATE POLICY "admin: gestionar seo_meta"
  ON seo_meta FOR ALL
  USING (current_user_role() = 'admin');

-- ------------------------------------------------------------
-- NOTIFICATION
-- ------------------------------------------------------------
CREATE POLICY "notif: usuario ve sus notificaciones"
  ON notification FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notif: usuario puede marcar como leída"
  ON notification FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "admin: gestionar todas las notificaciones"
  ON notification FOR ALL
  USING (current_user_role() = 'admin');
