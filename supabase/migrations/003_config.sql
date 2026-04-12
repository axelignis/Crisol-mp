-- ============================================================
-- CRISOL -- Migracion 003: Configuracion global
-- Membership levels, comision versionada, cupones.
-- ============================================================

-- ------------------------------------------------------------
-- MEMBERSHIP_LEVEL -- niveles de membresia configurables
-- ------------------------------------------------------------
CREATE TABLE membership_level (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  points_threshold    INTEGER NOT NULL DEFAULT 0,
  discount_pct        NUMERIC(5,2) NOT NULL DEFAULT 0,
  free_shipping       BOOLEAN NOT NULL DEFAULT false,
  early_access        BOOLEAN NOT NULL DEFAULT false,
  commission_discount BOOLEAN NOT NULL DEFAULT false,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  membership_level                    IS 'Niveles de membresia configurables. Nombres y umbrales definidos por el admin.';
COMMENT ON COLUMN membership_level.points_threshold   IS 'Minimo de puntos acumulados para alcanzar este nivel.';
COMMENT ON COLUMN membership_level.discount_pct       IS 'Porcentaje de descuento en compras para este nivel.';

-- Datos semilla: 2 niveles iniciales
INSERT INTO membership_level (name, points_threshold, discount_pct, free_shipping, early_access, commission_discount, sort_order)
VALUES
  ('Estandar', 0,   0,  false, false, false, 1),
  ('Premium',  500, 5,  true,  true,  true,  2);

-- ------------------------------------------------------------
-- COMMISSION_CONFIG -- configuracion versionada de comisiones
-- Inmutable: nunca se actualiza, se inserta una nueva fila.
-- ------------------------------------------------------------
CREATE TABLE commission_config (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_pct           NUMERIC(5,2) NOT NULL DEFAULT 10,
  free_shipping_threshold  INTEGER NOT NULL DEFAULT 50000,      -- CLP (integer)
  points_per_purchase      INTEGER NOT NULL DEFAULT 1,
  points_to_clp_rate       INTEGER NOT NULL DEFAULT 10,         -- 1 punto = 10 CLP
  effective_from           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID REFERENCES "user"(id),
  notes                    TEXT
);

COMMENT ON TABLE  commission_config                        IS 'Configuracion de comision versionada. Se inserta fila nueva en cada cambio -- nunca se actualiza.';
COMMENT ON COLUMN commission_config.commission_pct         IS 'Porcentaje de comision del admin sobre cada venta. Ej: 10 = 10%.';
COMMENT ON COLUMN commission_config.free_shipping_threshold IS 'Monto minimo del pedido (CLP) para envio gratuito.';
COMMENT ON COLUMN commission_config.points_to_clp_rate     IS 'Cuantos CLP vale 1 punto al canjear. Ej: 10 = $10 CLP por punto.';

-- ------------------------------------------------------------
-- COUPON -- codigos de descuento
-- ------------------------------------------------------------
CREATE TABLE coupon (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT UNIQUE NOT NULL,
  discount_type  TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value INTEGER NOT NULL,       -- CLP si fixed, porcentaje entero si percentage
  min_order      INTEGER,                -- CLP
  uses_limit     INTEGER,
  uses_count     INTEGER NOT NULL DEFAULT 0,
  expires_at     TIMESTAMPTZ,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_by     UUID REFERENCES "user"(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  coupon                IS 'Cupones de descuento gestionados por el admin.';
COMMENT ON COLUMN coupon.discount_type  IS 'percentage = % del total | fixed = monto fijo en CLP.';
COMMENT ON COLUMN coupon.uses_limit     IS 'NULL = usos ilimitados.';

-- FK de buyer a membership_level (ahora que membership_level existe)
ALTER TABLE buyer
  ADD CONSTRAINT buyer_membership_level_fkey
  FOREIGN KEY (membership_level_id) REFERENCES membership_level(id);
