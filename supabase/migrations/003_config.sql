-- ============================================================
-- CRISOL — Migración 003: Configuración global
-- Estas tablas se crean antes del catálogo y comercio
-- porque otras tablas referencian membership_level y commission_config.
-- ============================================================

-- ------------------------------------------------------------
-- MEMBERSHIP_LEVEL — niveles de membresía configurables
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

COMMENT ON TABLE  membership_level                    IS 'Niveles de membresía configurables. Nombres y umbrales definidos por el admin.';
COMMENT ON COLUMN membership_level.points_threshold   IS 'Mínimo de puntos acumulados para alcanzar este nivel.';
COMMENT ON COLUMN membership_level.discount_pct       IS 'Porcentaje de descuento en compras para este nivel.';
COMMENT ON COLUMN membership_level.early_access       IS 'true = acceso anticipado a piezas nuevas antes de publicarse.';
COMMENT ON COLUMN membership_level.commission_discount IS 'true = descuento especial en piezas por encargo.';

-- Datos semilla: 2 niveles iniciales (nombres pueden cambiarse desde el panel)
INSERT INTO membership_level (name, points_threshold, discount_pct, free_shipping, early_access, commission_discount, sort_order)
VALUES
  ('Estándar', 0,   0,  false, false, false, 1),
  ('Premium',  500, 5,  true,  true,  true,  2);

-- ------------------------------------------------------------
-- COMMISSION_CONFIG — configuración versionada de comisiones
-- Inmutable: nunca se actualiza, se inserta una nueva fila.
-- ------------------------------------------------------------
CREATE TABLE commission_config (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_pct           NUMERIC(5,2) NOT NULL DEFAULT 10,
  free_shipping_threshold  NUMERIC(10,2) NOT NULL DEFAULT 50000,  -- en CLP
  points_per_purchase      INTEGER NOT NULL DEFAULT 1,
  points_to_clp_rate       NUMERIC(10,4) NOT NULL DEFAULT 10,     -- 1 punto = 10 CLP
  effective_from           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID REFERENCES "user"(id),
  notes                    TEXT
);

COMMENT ON TABLE  commission_config                      IS 'Configuración de comisión versionada. Se inserta fila nueva en cada cambio — nunca se actualiza.';
COMMENT ON COLUMN commission_config.commission_pct       IS 'Porcentaje de comisión del admin sobre cada venta. Ej: 10 = 10%.';
COMMENT ON COLUMN commission_config.free_shipping_threshold IS 'Monto mínimo del pedido (CLP) para envío gratuito.';
COMMENT ON COLUMN commission_config.points_to_clp_rate   IS 'Cuántos CLP vale 1 punto al canjear. Ej: 10 = $10 CLP por punto.';

-- Configuración inicial del sistema
INSERT INTO commission_config (commission_pct, free_shipping_threshold, points_per_purchase, points_to_clp_rate, notes)
VALUES (10, 50000, 1, 10, 'Configuración inicial del sistema');

-- ------------------------------------------------------------
-- COUPON — códigos de descuento
-- ------------------------------------------------------------
CREATE TABLE coupon (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT UNIQUE NOT NULL,
  discount_type  TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  min_order      NUMERIC(10,2),
  uses_limit     INTEGER,
  uses_count     INTEGER NOT NULL DEFAULT 0,
  expires_at     TIMESTAMPTZ,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_by     UUID REFERENCES "user"(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  coupon                IS 'Cupones de descuento gestionados por el admin.';
COMMENT ON COLUMN coupon.discount_type  IS 'percentage = % del total | fixed = monto fijo en la moneda del pedido.';
COMMENT ON COLUMN coupon.uses_limit     IS 'NULL = usos ilimitados.';

-- FK de buyer a membership_level (ahora que membership_level existe)
ALTER TABLE buyer
  ADD CONSTRAINT buyer_membership_level_fkey
  FOREIGN KEY (membership_level_id) REFERENCES membership_level(id);
