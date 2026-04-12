-- ============================================================
-- CRISOL — Migración 004: Catálogo
-- Categorías, tags, productos, variantes, multimedia y encargos.
-- ============================================================

-- ------------------------------------------------------------
-- CATEGORY — taxonomía jerárquica del catálogo
-- ------------------------------------------------------------
CREATE TABLE category (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  parent_id   UUID REFERENCES category(id),
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  category           IS 'Categorías del catálogo con soporte de jerarquía (subcategorías via parent_id).';
COMMENT ON COLUMN category.parent_id IS 'NULL = categoría raíz. Referencia a sí misma para subcategorías.';

-- Categorías semilla
INSERT INTO category (name, slug, sort_order) VALUES
  ('Anillos',     'anillos',     1),
  ('Collares',    'collares',    2),
  ('Pendientes',  'pendientes',  3),
  ('Pulseras',    'pulseras',    4),
  ('Arte decorativo', 'arte-decorativo', 5);

-- ------------------------------------------------------------
-- TAG — etiquetas polivalentes (materiales, ocasiones, técnicas)
-- ------------------------------------------------------------
CREATE TABLE tag (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('material', 'occasion', 'technique', 'style')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  tag      IS 'Etiquetas para filtrar productos. Tipo determina en qué filtro aparecen.';
COMMENT ON COLUMN tag.type IS 'material | occasion | technique | style';

-- Tags semilla — materiales
INSERT INTO tag (name, slug, type) VALUES
  ('Oro 18k',       'oro-18k',      'material'),
  ('Oro 14k',       'oro-14k',      'material'),
  ('Plata 925',     'plata-925',    'material'),
  ('Bronce',        'bronce',       'material'),
  ('Cobre',         'cobre',        'material');

-- Tags semilla — ocasiones
INSERT INTO tag (name, slug, type) VALUES
  ('Matrimonio',    'matrimonio',   'occasion'),
  ('Regalo',        'regalo',       'occasion'),
  ('Cotidiano',     'cotidiano',    'occasion'),
  ('Aniversario',   'aniversario',  'occasion');

-- Tags semilla — técnicas
INSERT INTO tag (name, slug, type) VALUES
  ('Forjado a mano',  'forjado-mano',   'technique'),
  ('Cincelado',       'cincelado',      'technique'),
  ('Fundición',       'fundicion',      'technique'),
  ('Filigrana',       'filigrana',      'technique');

-- ------------------------------------------------------------
-- PRODUCT — pieza artesanal
-- ------------------------------------------------------------
CREATE TABLE product (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id       UUID NOT NULL REFERENCES artisan(id) ON DELETE CASCADE,
  category_id      UUID REFERENCES category(id),
  title            TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  description      TEXT,
  base_price       NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  currency         TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
  is_unique        BOOLEAN NOT NULL DEFAULT false,
  type             TEXT NOT NULL DEFAULT 'jewelry_series'
                     CHECK (type IN ('jewelry_unique', 'jewelry_series', 'decorative', 'commission')),
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'pending_review', 'published', 'changes_requested', 'rejected', 'sold')),
  is_visible       BOOLEAN NOT NULL DEFAULT true,
  rejection_notes  TEXT,
  approved_by      UUID REFERENCES "user"(id),
  approved_at      TIMESTAMPTZ,
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  product                  IS 'Pieza artesanal. Piezas vendidas (sold) permanecen visibles como portafolio.';
COMMENT ON COLUMN product.is_unique        IS 'true = stock máximo 1. Pasa a sold automáticamente al venderse.';
COMMENT ON COLUMN product.status           IS 'draft → pending_review → published | changes_requested | rejected';
COMMENT ON COLUMN product.rejection_notes  IS 'Motivo del rechazo por parte del admin. Visible solo para el artesano.';
COMMENT ON COLUMN product.slug             IS 'URL amigable única. Generada automáticamente desde el título.';

-- ------------------------------------------------------------
-- PRODUCT_VARIANT — variantes de una pieza
-- ------------------------------------------------------------
CREATE TABLE product_variant (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  size            TEXT,
  material        TEXT,
  color           TEXT,
  stones          TEXT,
  price_modifier  NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock           INTEGER NOT NULL DEFAULT 1 CHECK (stock >= 0),
  sku             TEXT,
  is_available    BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  product_variant                IS 'Variante de una pieza (talla, material, color, piedras).';
COMMENT ON COLUMN product_variant.price_modifier IS 'Monto sumado al base_price del producto. Puede ser negativo.';
COMMENT ON COLUMN product_variant.stock          IS 'Unidades disponibles de esta variante. 0 = agotado.';

-- ------------------------------------------------------------
-- PRODUCT_MEDIA — fotos, video y modelo 3D por pieza
-- ------------------------------------------------------------
CREATE TABLE product_media (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('photo', 'video', 'model_3d')),
  url           TEXT NOT NULL,
  cloudinary_id TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_cover      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  product_media              IS 'Multimedia asociada a una pieza. Máx 10 fotos, 1 video, 1 modelo 3D.';
COMMENT ON COLUMN product_media.is_cover     IS 'true = imagen principal mostrada en el catálogo y cards.';
COMMENT ON COLUMN product_media.cloudinary_id IS 'ID del asset en Cloudinary para transformaciones on-the-fly.';

-- Límites por producto: 10 fotos, 1 video, 1 modelo 3D.
-- Implementados como trigger porque Postgres no permite subqueries en CHECK.
CREATE OR REPLACE FUNCTION enforce_product_media_limits()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed   INTEGER;
BEGIN
  max_allowed := CASE NEW.type
    WHEN 'photo'    THEN 10
    WHEN 'video'    THEN 1
    WHEN 'model_3d' THEN 1
  END;

  SELECT COUNT(*) INTO current_count
  FROM product_media
  WHERE product_id = NEW.product_id
    AND type = NEW.type
    AND id <> NEW.id;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'product_media limit exceeded for type % (max %)', NEW.type, max_allowed
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_media_enforce_limits
BEFORE INSERT OR UPDATE OF type, product_id ON product_media
FOR EACH ROW EXECUTE FUNCTION enforce_product_media_limits();

-- ------------------------------------------------------------
-- PRODUCT_TAG — relación muchos a muchos producto ↔ tag
-- ------------------------------------------------------------
CREATE TABLE product_tag (
  product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

-- ------------------------------------------------------------
-- COMMISSION_SLOT — slot de pieza por encargo
-- ------------------------------------------------------------
CREATE TABLE commission_slot (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id      UUID NOT NULL REFERENCES artisan(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  price           NUMERIC(10,2) NOT NULL CHECK (price > 0),
  currency        TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
  estimated_days  INTEGER NOT NULL DEFAULT 30,
  max_slots       INTEGER NOT NULL DEFAULT 1 CHECK (max_slots > 0),
  reserved_slots  INTEGER NOT NULL DEFAULT 0 CHECK (reserved_slots >= 0),
  is_available    BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT slots_not_exceeded CHECK (reserved_slots <= max_slots)
);

COMMENT ON TABLE  commission_slot                IS 'Slot de encargo publicado por el artesano. El comprador reserva y paga al confirmar.';
COMMENT ON COLUMN commission_slot.estimated_days IS 'Tiempo estimado de producción en días corridos.';
COMMENT ON COLUMN commission_slot.reserved_slots IS 'Slots ya reservados. Incrementa con cada reserva pagada.';
