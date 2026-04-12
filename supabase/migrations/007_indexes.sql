-- ============================================================
-- CRISOL — Migración 007: Índices de performance
-- Optimiza las consultas más frecuentes del sistema.
-- ============================================================

-- ------------------------------------------------------------
-- Usuarios
-- ------------------------------------------------------------
CREATE INDEX idx_user_role     ON "user"(role);
CREATE INDEX idx_user_email    ON "user"(email);
CREATE INDEX idx_artisan_user  ON artisan(user_id);
CREATE INDEX idx_buyer_user    ON buyer(user_id);
CREATE INDEX idx_buyer_level   ON buyer(membership_level_id);

-- ------------------------------------------------------------
-- Catálogo — las consultas más frecuentes de toda la app
-- ------------------------------------------------------------
-- Listar productos publicados del catálogo (página principal)
CREATE INDEX idx_product_published
  ON product(published_at DESC)
  WHERE status = 'published';

-- Filtrar por artesano (perfil público del artesano)
CREATE INDEX idx_product_artisan    ON product(artisan_id);

-- Filtrar por categoría
CREATE INDEX idx_product_category   ON product(category_id);

-- Búsqueda por estado (panel admin — cola de moderación)
CREATE INDEX idx_product_status     ON product(status);

-- Lookup por slug (SSG/ISR — acceso directo a página de producto)
CREATE INDEX idx_product_slug       ON product(slug);

-- Variantes disponibles
CREATE INDEX idx_variant_product    ON product_variant(product_id);
CREATE INDEX idx_variant_available  ON product_variant(product_id) WHERE is_available = true;

-- Multimedia ordenada
CREATE INDEX idx_media_product      ON product_media(product_id, sort_order);
CREATE INDEX idx_media_cover        ON product_media(product_id) WHERE is_cover = true;

-- Tags de un producto
CREATE INDEX idx_product_tag_product ON product_tag(product_id);
CREATE INDEX idx_product_tag_tag     ON product_tag(tag_id);

-- Slots de encargo disponibles por artesano
CREATE INDEX idx_slot_artisan_avail
  ON commission_slot(artisan_id)
  WHERE is_available = true AND reserved_slots < max_slots;

-- ------------------------------------------------------------
-- Comercio
-- ------------------------------------------------------------
-- Pedidos de un comprador (historial)
CREATE INDEX idx_order_buyer        ON "order"(buyer_id, created_at DESC);

-- Pedidos por estado (panel artesano y admin)
CREATE INDEX idx_order_status       ON "order"(status, created_at DESC);

-- Items de un pedido
CREATE INDEX idx_item_order         ON order_item(order_id);

-- Items por artesano (panel del artesano — mis ventas)
CREATE INDEX idx_item_artisan       ON order_item(artisan_id, created_at DESC);

-- Pagos — lookup por IDs de Stripe (webhooks)
CREATE INDEX idx_payment_order      ON payment(order_id);
CREATE INDEX idx_payment_intent
  ON payment(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Despachos por artesano
CREATE INDEX idx_shipment_artisan   ON shipment(artisan_id, created_at DESC);
CREATE INDEX idx_shipment_order     ON shipment(order_id);

-- ------------------------------------------------------------
-- Fidelización
-- ------------------------------------------------------------
-- Historial de puntos de un comprador
CREATE INDEX idx_loyalty_buyer      ON loyalty_transaction(buyer_id, created_at DESC);

-- Reseñas aprobadas de un producto
CREATE INDEX idx_review_product
  ON review(product_id)
  WHERE is_approved = true;

-- Wishlist de un comprador
CREATE INDEX idx_wishlist_buyer     ON wishlist_item(buyer_id);

-- Seguidores de un artesano (para notificaciones masivas)
CREATE INDEX idx_follower_artisan   ON artisan_follower(artisan_id);
CREATE INDEX idx_follower_buyer     ON artisan_follower(buyer_id);

-- ------------------------------------------------------------
-- Contenido y notificaciones
-- ------------------------------------------------------------
-- Blog publicado (sitemap, catálogo editorial)
CREATE INDEX idx_blog_published
  ON blog_post(published_at DESC)
  WHERE status = 'published';

CREATE INDEX idx_blog_slug          ON blog_post(slug);

-- SEO meta lookup (generación de metadatos en SSG/ISR)
CREATE INDEX idx_seo_entity         ON seo_meta(entity_type, entity_id);

-- Notificaciones no leídas de un usuario
CREATE INDEX idx_notif_user_unread
  ON notification(user_id, created_at DESC)
  WHERE is_read = false;

-- ------------------------------------------------------------
-- Configuración
-- ------------------------------------------------------------
-- Config más reciente (consulta frecuente en cada pago)
CREATE INDEX idx_commission_recent  ON commission_config(effective_from DESC);

-- Cupones activos
CREATE INDEX idx_coupon_code        ON coupon(code) WHERE is_active = true;
