-- ============================================================
-- CRISOL -- Migracion 006: Fidelizacion, social y contenido
-- Puntos, resenas, favoritos, seguidores, blog y SEO.
-- ============================================================

-- ------------------------------------------------------------
-- LOYALTY_TRANSACTION -- historial de puntos
-- ------------------------------------------------------------
CREATE TABLE loyalty_transaction (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id      UUID NOT NULL REFERENCES buyer(id) ON DELETE CASCADE,
  order_id      UUID REFERENCES "order"(id),
  points_delta  INTEGER NOT NULL,
  type          TEXT NOT NULL CHECK (type IN (
    'earn_purchase',
    'redeem',
    'manual_adjust',
    'expire'
  )),
  description   TEXT,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  loyalty_transaction              IS 'Historial completo de puntos por comprador. Inmutable.';
COMMENT ON COLUMN loyalty_transaction.points_delta IS 'Positivo = acumulacion, Negativo = canje o expiracion.';
COMMENT ON COLUMN loyalty_transaction.balance_after IS 'Saldo de puntos del comprador despues de esta transaccion.';

-- ------------------------------------------------------------
-- REVIEW -- resena verificada
-- ------------------------------------------------------------
CREATE TABLE review (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  buyer_id      UUID NOT NULL REFERENCES buyer(id),
  order_id      UUID NOT NULL REFERENCES "order"(id),
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  is_approved   BOOLEAN NOT NULL DEFAULT false,
  moderated_by  UUID REFERENCES "user"(id),
  moderated_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, buyer_id, order_id)
);

COMMENT ON TABLE  review             IS 'Resena verificada. Solo compradores con ORDER entregada pueden resenar.';
COMMENT ON COLUMN review.is_approved IS 'false = pendiente de moderacion. Solo resenas aprobadas son visibles.';

-- ------------------------------------------------------------
-- WISHLIST_ITEM -- lista de deseos
-- ------------------------------------------------------------
CREATE TABLE wishlist_item (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id   UUID NOT NULL REFERENCES buyer(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, product_id)
);

COMMENT ON TABLE wishlist_item IS 'Lista de deseos del comprador. Relacion unica buyer <-> product.';

-- ------------------------------------------------------------
-- ARTISAN_FOLLOWER -- seguimiento de artesanos
-- ------------------------------------------------------------
CREATE TABLE artisan_follower (
  buyer_id    UUID NOT NULL REFERENCES buyer(id) ON DELETE CASCADE,
  artisan_id  UUID NOT NULL REFERENCES artisan(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_id, artisan_id)
);

COMMENT ON TABLE artisan_follower IS 'Relacion comprador -> artesano. Genera notificaciones al publicar piezas.';

-- ------------------------------------------------------------
-- BLOG_POST -- articulos editoriales
-- ------------------------------------------------------------
CREATE TABLE blog_post (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id         UUID NOT NULL REFERENCES "user"(id),
  title             TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  excerpt           TEXT,
  content           TEXT,
  featured_image_url TEXT,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published', 'archived')),
  meta_title        TEXT,
  meta_description  TEXT,
  og_image_url      TEXT,
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE blog_post IS 'Articulo editorial. Gestionado desde el panel de admin.';

CREATE TRIGGER tg_blog_updated_at
  BEFORE UPDATE ON blog_post
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ------------------------------------------------------------
-- SEO_META -- metadatos SEO polimorficos
-- ------------------------------------------------------------
CREATE TABLE seo_meta (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('product', 'artisan', 'category', 'blog_post', 'page')),
  entity_id     UUID NOT NULL,
  meta_title    TEXT,
  meta_description TEXT,
  og_image_url  TEXT,
  canonical_url TEXT,
  schema_json   JSONB,
  hreflang      JSONB,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

COMMENT ON TABLE  seo_meta           IS 'Metadatos SEO y Schema.org para cualquier entidad. Diseno polimorfico.';
COMMENT ON COLUMN seo_meta.schema_json IS 'JSON-LD de Schema.org (Product, Person, FAQPage, etc.).';
COMMENT ON COLUMN seo_meta.hreflang   IS 'Mapa de URLs por locale. Ej: {"es": "/es/...", "en": "/en/..."}.';

-- ------------------------------------------------------------
-- NOTIFICATION -- notificaciones del sistema
-- ------------------------------------------------------------
CREATE TABLE notification (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN (
    'new_order',
    'order_status_change',
    'piece_approved',
    'piece_rejected',
    'new_follower',
    'artisan_new_piece',
    'commission_reserved',
    'review_posted',
    'points_earned',
    'membership_upgrade'
  )),
  title      TEXT NOT NULL,
  body       TEXT,
  data       JSONB,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  notification      IS 'Notificaciones internas del sistema.';
COMMENT ON COLUMN notification.data IS 'JSON con IDs de contexto para generar deep-links en el frontend.';

-- ------------------------------------------------------------
-- Triggers adicionales de fidelizacion
-- ------------------------------------------------------------

-- Sincronizar total_points del buyer con cada transaccion
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

-- Verificar y actualizar nivel de membresia automaticamente
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

-- Marcar producto como 'sold' al agotar stock (piezas unicas)
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
