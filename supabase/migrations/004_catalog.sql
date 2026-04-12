-- ============================================================
-- CRISOL -- Migracion 004: Catalogo
-- Categorias, tags, productos, variantes, multimedia y encargos.
-- Precios en INTEGER (CLP canonico).
-- ============================================================

-- ------------------------------------------------------------
-- CATEGORY -- taxonomia jerarquica del catalogo
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

COMMENT ON TABLE  category           IS 'Categorias del catalogo con soporte de jerarquia (subcategorias via parent_id).';
COMMENT ON COLUMN category.parent_id IS 'NULL = categoria raiz. Referencia a si misma para subcategorias.';

-- ------------------------------------------------------------
-- TAG -- etiquetas polivalentes (materiales, ocasiones, tecnicas)
-- ------------------------------------------------------------
CREATE TABLE tag (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('material', 'occasion', 'technique', 'style')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  tag      IS 'Etiquetas para filtrar productos. Tipo determina en que filtro aparecen.';
COMMENT ON COLUMN tag.type IS 'material | occasion | technique | style';

-- ------------------------------------------------------------
-- PRODUCT -- pieza artesanal (precios INTEGER CLP)
-- ------------------------------------------------------------
CREATE TABLE product (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id       UUID NOT NULL REFERENCES artisan(id) ON DELETE CASCADE,
  category_id      UUID REFERENCES category(id),
  title            TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  description      TEXT,
  base_price       INTEGER NOT NULL CHECK (base_price >= 0),
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

COMMENT ON TABLE  product                  IS 'Pieza artesanal. Precios en CLP (INTEGER). Piezas sold permanecen visibles como portafolio.';
COMMENT ON COLUMN product.base_price       IS 'Precio base en CLP (entero). USD es display-only via /api/currency.';
COMMENT ON COLUMN product.is_unique        IS 'true = stock maximo 1. Pasa a sold automaticamente al venderse.';
COMMENT ON COLUMN product.status           IS 'draft -> pending_review -> published | changes_requested | rejected | sold';

CREATE TRIGGER tg_product_updated_at
  BEFORE UPDATE ON product
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ------------------------------------------------------------
-- PRODUCT_VARIANT -- variantes de una pieza
-- ------------------------------------------------------------
CREATE TABLE product_variant (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  size            TEXT,
  material        TEXT,
  color           TEXT,
  stones          TEXT,
  price_modifier  INTEGER NOT NULL DEFAULT 0,
  stock           INTEGER NOT NULL DEFAULT 1 CHECK (stock >= 0),
  sku             TEXT,
  is_available    BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  product_variant                IS 'Variante de una pieza (talla, material, color, piedras).';
COMMENT ON COLUMN product_variant.price_modifier IS 'Monto en CLP sumado al base_price del producto. Puede ser negativo.';
COMMENT ON COLUMN product_variant.stock          IS 'Unidades disponibles de esta variante. 0 = agotado.';

-- ------------------------------------------------------------
-- PRODUCT_MEDIA -- fotos, video y modelo 3D por pieza
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

COMMENT ON TABLE  product_media              IS 'Multimedia asociada a una pieza. Max 10 fotos, 1 video, 1 modelo 3D.';
COMMENT ON COLUMN product_media.is_cover     IS 'true = imagen principal mostrada en el catalogo y cards.';
COMMENT ON COLUMN product_media.cloudinary_id IS 'ID del asset en Cloudinary para transformaciones on-the-fly.';

-- Limites por producto: 10 fotos, 1 video, 1 modelo 3D
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
-- PRODUCT_TAG -- relacion muchos a muchos producto <-> tag
-- ------------------------------------------------------------
CREATE TABLE product_tag (
  product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

-- ------------------------------------------------------------
-- COMMISSION_SLOT -- slot de pieza por encargo (precio INTEGER CLP)
-- ------------------------------------------------------------
CREATE TABLE commission_slot (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id      UUID NOT NULL REFERENCES artisan(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  price           INTEGER NOT NULL CHECK (price > 0),
  estimated_days  INTEGER NOT NULL DEFAULT 30,
  max_slots       INTEGER NOT NULL DEFAULT 1 CHECK (max_slots > 0),
  reserved_slots  INTEGER NOT NULL DEFAULT 0 CHECK (reserved_slots >= 0),
  is_available    BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT slots_not_exceeded CHECK (reserved_slots <= max_slots)
);

COMMENT ON TABLE  commission_slot                IS 'Slot de encargo publicado por el artesano. Precio en CLP (INTEGER).';
COMMENT ON COLUMN commission_slot.price          IS 'Precio del encargo en CLP.';
COMMENT ON COLUMN commission_slot.estimated_days IS 'Tiempo estimado de produccion en dias corridos.';

CREATE TRIGGER tg_commission_slot_updated_at
  BEFORE UPDATE ON commission_slot
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
