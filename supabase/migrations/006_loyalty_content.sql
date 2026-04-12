-- ============================================================
-- CRISOL — Migración 006: Fidelización, social y contenido
-- Puntos, reseñas, favoritos, seguidores, blog y SEO.
-- ============================================================

-- ------------------------------------------------------------
-- LOYALTY_TRANSACTION — historial de puntos
-- ------------------------------------------------------------
CREATE TABLE loyalty_transaction (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id      UUID NOT NULL REFERENCES buyer(id) ON DELETE CASCADE,
  order_id      UUID REFERENCES "order"(id),
  points_delta  INTEGER NOT NULL,  -- positivo = acumula, negativo = canjea
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

COMMENT ON TABLE  loyalty_transaction              IS 'Historial completo de puntos por comprador. Inmutable — nunca se modifica.';
COMMENT ON COLUMN loyalty_transaction.points_delta IS 'Positivo = acumulación, Negativo = canje o expiración.';
COMMENT ON COLUMN loyalty_transaction.balance_after IS 'Saldo de puntos del comprador después de esta transacción.';

-- ------------------------------------------------------------
-- REVIEW — reseña verificada
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

COMMENT ON TABLE  review             IS 'Reseña verificada. Solo compradores con ORDER entregada pueden reseñar. Requiere aprobación del admin.';
COMMENT ON COLUMN review.is_approved IS 'false = pendiente de moderación. Solo reseñas aprobadas son visibles al público.';

-- ------------------------------------------------------------
-- WISHLIST_ITEM — lista de deseos
-- ------------------------------------------------------------
CREATE TABLE wishlist_item (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id   UUID NOT NULL REFERENCES buyer(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, product_id)
);

COMMENT ON TABLE wishlist_item IS 'Lista de deseos del comprador. Relación única buyer ↔ product.';

-- ------------------------------------------------------------
-- ARTISAN_FOLLOWER — seguimiento de artesanos
-- ------------------------------------------------------------
CREATE TABLE artisan_follower (
  buyer_id    UUID NOT NULL REFERENCES buyer(id) ON DELETE CASCADE,
  artisan_id  UUID NOT NULL REFERENCES artisan(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_id, artisan_id)
);

COMMENT ON TABLE artisan_follower IS 'Relación comprador → artesano. Genera notificaciones cuando el artesano publica nuevas piezas.';

-- ------------------------------------------------------------
-- BLOG_POST — artículos editoriales
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

COMMENT ON TABLE blog_post IS 'Artículo editorial. Gestionado desde el panel de admin con soporte de IA como asistente.';

-- ------------------------------------------------------------
-- SEO_META — metadatos SEO polimórficos
-- Una sola tabla para productos, artesanos, categorías y blog.
-- ------------------------------------------------------------
CREATE TABLE seo_meta (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('product', 'artisan', 'category', 'blog_post', 'page')),
  entity_id     UUID NOT NULL,
  meta_title    TEXT,
  meta_description TEXT,
  og_image_url  TEXT,
  canonical_url TEXT,
  schema_json   JSONB,  -- Schema.org JSON-LD (Product, Person, FAQPage, etc.)
  hreflang      JSONB,  -- {"es": "/es/...", "en": "/en/..."}
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

COMMENT ON TABLE  seo_meta           IS 'Metadatos SEO y Schema.org para cualquier entidad del sistema. Diseño polimórfico.';
COMMENT ON COLUMN seo_meta.schema_json IS 'JSON-LD de Schema.org. Tipos: Product, Person, FAQPage, Organization, BlogPosting, BreadcrumbList.';
COMMENT ON COLUMN seo_meta.hreflang   IS 'Mapa de URLs por locale. Ej: {"es": "/es/pieza", "en": "/en/piece"}.';

-- ------------------------------------------------------------
-- NOTIFICATION — notificaciones del sistema
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
  data       JSONB,      -- contexto extra: order_id, product_id, artisan_id, etc.
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  notification      IS 'Notificaciones internas del sistema. Se complementa con emails (Resend) y Web Push.';
COMMENT ON COLUMN notification.data IS 'JSON con IDs de contexto para generar deep-links en el frontend.';
