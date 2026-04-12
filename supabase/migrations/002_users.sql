-- ============================================================
-- CRISOL — Migración 002: Usuarios y roles
-- Tabla base USER extiende Supabase Auth.
-- Perfiles ARTISAN y BUYER se crean automáticamente via trigger.
-- ============================================================

-- ------------------------------------------------------------
-- USER — tabla base para todos los roles
-- ------------------------------------------------------------
CREATE TABLE "user" (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'buyer'
                  CHECK (role IN ('admin', 'artisan', 'buyer')),
  locale        TEXT NOT NULL DEFAULT 'es',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  "user"           IS 'Tabla base para todos los roles del sistema. 1:1 con auth.users de Supabase.';
COMMENT ON COLUMN "user".role      IS 'admin | artisan | buyer';
COMMENT ON COLUMN "user".locale    IS 'Locale preferido del usuario (es, en, etc.)';

-- ------------------------------------------------------------
-- ARTISAN — perfil público del artesano
-- ------------------------------------------------------------
CREATE TABLE artisan (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID UNIQUE NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  bio                 TEXT,
  photo_url           TEXT,
  instagram           TEXT,
  website             TEXT,
  stripe_account_id   TEXT,              -- Stripe Connect account ID
  stripe_onboarded    BOOLEAN NOT NULL DEFAULT false,
  is_suspended        BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  artisan                    IS 'Perfil público de cada artesano. 1:1 con USER donde role = artisan.';
COMMENT ON COLUMN artisan.stripe_account_id  IS 'ID de la cuenta Stripe Connect del artesano. Requerido para recibir pagos.';
COMMENT ON COLUMN artisan.stripe_onboarded   IS 'true cuando el artesano completó el onboarding de Stripe Connect.';

-- ------------------------------------------------------------
-- BUYER — perfil del comprador con fidelización
-- ------------------------------------------------------------
CREATE TABLE buyer (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID UNIQUE NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  total_points          INTEGER NOT NULL DEFAULT 0,
  membership_level_id   UUID,            -- FK añadido en migración 006 (después de membership_level)
  level_since           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  buyer               IS 'Perfil del comprador. 1:1 con USER donde role = buyer.';
COMMENT ON COLUMN buyer.total_points  IS 'Puntos acumulados actuales. Se sincroniza automáticamente via trigger.';
