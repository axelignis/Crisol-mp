-- ============================================================
-- CRISOL -- Migracion 012: Seed data
-- Comision inicial, categorias y tags.
-- ============================================================

-- ------------------------------------------------------------
-- Comision inicial: 10% (D-08)
-- ------------------------------------------------------------
INSERT INTO commission_config (
  commission_pct,
  free_shipping_threshold,
  points_per_purchase,
  points_to_clp_rate,
  notes
) VALUES (
  10,
  50000,
  1,
  10,
  'Configuracion inicial del sistema'
);

-- ------------------------------------------------------------
-- Categorias semilla
-- ------------------------------------------------------------
INSERT INTO category (name, slug, sort_order) VALUES
  ('Anillos',           'anillos',           1),
  ('Collares',          'collares',          2),
  ('Pendientes',        'pendientes',        3),
  ('Pulseras',          'pulseras',          4),
  ('Arte decorativo',   'arte-decorativo',   5);

-- ------------------------------------------------------------
-- Tags semilla -- materiales
-- ------------------------------------------------------------
INSERT INTO tag (name, slug, type) VALUES
  ('Oro 18k',       'oro-18k',      'material'),
  ('Oro 14k',       'oro-14k',      'material'),
  ('Plata 925',     'plata-925',    'material'),
  ('Bronce',        'bronce',       'material'),
  ('Cobre',         'cobre',        'material');

-- Tags semilla -- ocasiones
INSERT INTO tag (name, slug, type) VALUES
  ('Matrimonio',    'matrimonio',   'occasion'),
  ('Regalo',        'regalo',       'occasion'),
  ('Cotidiano',     'cotidiano',    'occasion'),
  ('Aniversario',   'aniversario',  'occasion');

-- Tags semilla -- tecnicas
INSERT INTO tag (name, slug, type) VALUES
  ('Forjado a mano',  'forjado-mano',   'technique'),
  ('Cincelado',       'cincelado',      'technique'),
  ('Fundicion',       'fundicion',      'technique'),
  ('Filigrana',       'filigrana',      'technique');
