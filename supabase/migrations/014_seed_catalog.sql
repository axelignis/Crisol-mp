-- ============================================================
-- CRISOL -- Migracion 014: Seed de categorias y tags del catalogo
-- Datos iniciales para filtrado y navegacion.
-- Idempotente: ON CONFLICT DO NOTHING.
-- ============================================================

-- ------------------------------------------------------------
-- CATEGORIES -- taxonomia principal del marketplace
-- ------------------------------------------------------------
INSERT INTO category (name, slug, description, sort_order) VALUES
  ('Anillos', 'anillos', 'Anillos artesanales', 1),
  ('Collares', 'collares', 'Collares y cadenas artesanales', 2),
  ('Pulseras', 'pulseras', 'Pulseras artesanales', 3),
  ('Aros', 'aros', 'Aros y pendientes artesanales', 4),
  ('Broches', 'broches', 'Broches y prendedores', 5),
  ('Arte Decorativo', 'arte-decorativo', 'Piezas decorativas artesanales', 6)
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------
-- TAGS -- material
-- ------------------------------------------------------------
INSERT INTO tag (name, slug, type) VALUES
  ('Plata 925', 'plata-925', 'material'),
  ('Oro 18k', 'oro-18k', 'material'),
  ('Cobre', 'cobre', 'material'),
  ('Bronce', 'bronce', 'material'),
  ('Alpaca', 'alpaca', 'material'),
  ('Piedras naturales', 'piedras-naturales', 'material'),
  ('Madera', 'madera', 'material'),
  ('Resina', 'resina', 'material')
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------
-- TAGS -- occasion
-- ------------------------------------------------------------
INSERT INTO tag (name, slug, type) VALUES
  ('Boda', 'boda', 'occasion'),
  ('Aniversario', 'aniversario', 'occasion'),
  ('Regalo', 'regalo', 'occasion'),
  ('Uso diario', 'uso-diario', 'occasion'),
  ('Fiesta', 'fiesta', 'occasion')
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------
-- TAGS -- technique
-- ------------------------------------------------------------
INSERT INTO tag (name, slug, type) VALUES
  ('Filigrana', 'filigrana', 'technique'),
  ('Repujado', 'repujado', 'technique'),
  ('Fundicion', 'fundicion', 'technique'),
  ('Esmaltado', 'esmaltado', 'technique'),
  ('Engaste', 'engaste', 'technique'),
  ('Tejido', 'tejido', 'technique'),
  ('Grabado', 'grabado', 'technique')
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------
-- TAGS -- style
-- ------------------------------------------------------------
INSERT INTO tag (name, slug, type) VALUES
  ('Minimalista', 'minimalista', 'style'),
  ('Bohemio', 'bohemio', 'style'),
  ('Clasico', 'clasico', 'style'),
  ('Contemporaneo', 'contemporaneo', 'style'),
  ('Etnico', 'etnico', 'style')
ON CONFLICT (slug) DO NOTHING;
