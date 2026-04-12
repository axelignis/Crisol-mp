-- ============================================================
-- CRISOL -- Migracion 002: Usuarios y roles
-- Tabla base USER extiende Supabase Auth.
-- Perfiles ARTISAN y BUYER se crean automaticamente via trigger.
--
-- MODELO DE PAGOS: Stripe Connect Express. Cada artesano tiene
-- su propia cuenta Stripe Connect. El admin cobra comision
-- automatica via Application Fee en cada pago.
-- ============================================================

-- ------------------------------------------------------------
-- Funcion updated_at reutilizable
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- USER -- tabla base para todos los roles
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
COMMENT ON COLUMN "user".locale    IS 'Locale preferido del usuario (es, en).';

CREATE TRIGGER tg_user_updated_at
  BEFORE UPDATE ON "user"
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ------------------------------------------------------------
-- ARTISAN -- perfil publico del artesano (Stripe Connect)
-- ------------------------------------------------------------
CREATE TABLE artisan (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID UNIQUE NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  bio                 TEXT,
  photo_url           TEXT,
  slug                TEXT UNIQUE,
  instagram           TEXT,
  website             TEXT,
  stripe_account_id   TEXT,       -- Stripe Connect Express account ID (acct_...)
  is_suspended        BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  artisan                    IS 'Perfil del artesano. Pagos via Stripe Connect Express.';
COMMENT ON COLUMN artisan.stripe_account_id  IS 'ID de cuenta Stripe Connect Express (acct_...). NULL hasta completar onboarding.';
COMMENT ON COLUMN artisan.slug               IS 'URL slug para el perfil publico del artesano.';

CREATE TRIGGER tg_artisan_updated_at
  BEFORE UPDATE ON artisan
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ------------------------------------------------------------
-- BUYER -- perfil del comprador con fidelizacion
-- ------------------------------------------------------------
CREATE TABLE buyer (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID UNIQUE NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  total_points          INTEGER NOT NULL DEFAULT 0,
  membership_level_id   UUID,            -- FK anadido en 003_config.sql
  level_since           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  buyer               IS 'Perfil del comprador. 1:1 con USER donde role = buyer.';
COMMENT ON COLUMN buyer.total_points  IS 'Puntos acumulados actuales. Se sincroniza automaticamente via trigger.';

CREATE TRIGGER tg_buyer_updated_at
  BEFORE UPDATE ON buyer
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ------------------------------------------------------------
-- Triggers: auto-crear perfiles al registrarse
-- ------------------------------------------------------------

-- Auto-crear USER al registrarse en Supabase Auth
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

-- Auto-crear BUYER al crear usuario con role = buyer
CREATE OR REPLACE FUNCTION fn_create_buyer_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'buyer' THEN
    INSERT INTO buyer (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tg_create_buyer_profile
  AFTER INSERT ON "user"
  FOR EACH ROW EXECUTE FUNCTION fn_create_buyer_profile();

-- Auto-crear ARTISAN al crear usuario con role = artisan
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
