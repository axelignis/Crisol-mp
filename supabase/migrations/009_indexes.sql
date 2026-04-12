-- ============================================================
-- CRISOL -- Migracion 009: Indices de performance
-- Optimiza las consultas mas frecuentes del sistema.
-- ============================================================

-- ------------------------------------------------------------
-- Usuarios
-- ------------------------------------------------------------
CREATE INDEX idx_user_role     ON "user"(role);
CREATE INDEX idx_user_email    ON "user"(email);
CREATE INDEX idx_artisan_user  ON artisan(user_id);
CREATE INDEX idx_artisan_slug  ON artisan(slug);
CREATE INDEX idx_buyer_user    ON buyer(user_id);
CREATE INDEX idx_buyer_level   ON buyer(membership_level_id);

-- ------------------------------------------------------------
-- Catalogo
-- ------------------------------------------------------------
CREATE INDEX idx_product_published
  ON product(published_at DESC)
  WHERE status = 'published';

CREATE INDEX idx_product_artisan    ON product(artisan_id);
CREATE INDEX idx_product_category   ON product(category_id);
CREATE INDEX idx_product_status     ON product(status);
CREATE INDEX idx_product_slug       ON product(slug);

CREATE INDEX idx_variant_product    ON product_variant(product_id);
CREATE INDEX idx_variant_available  ON product_variant(product_id) WHERE is_available = true;

CREATE INDEX idx_media_product      ON product_media(product_id, sort_order);
CREATE INDEX idx_media_cover        ON product_media(product_id) WHERE is_cover = true;

CREATE INDEX idx_product_tag_product ON product_tag(product_id);
CREATE INDEX idx_product_tag_tag     ON product_tag(tag_id);

CREATE INDEX idx_slot_artisan_avail
  ON commission_slot(artisan_id)
  WHERE is_available = true AND reserved_slots < max_slots;

-- ------------------------------------------------------------
-- Comercio
-- ------------------------------------------------------------
CREATE INDEX idx_order_buyer        ON "order"(buyer_id, created_at DESC);
CREATE INDEX idx_order_status       ON "order"(status, created_at DESC);

CREATE INDEX idx_item_order         ON order_item(order_id);
CREATE INDEX idx_item_artisan       ON order_item(artisan_id, created_at DESC);

CREATE INDEX idx_payment_order      ON payment(order_id);
CREATE INDEX idx_payment_intent
  ON payment(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX idx_shipment_artisan   ON shipment(artisan_id, created_at DESC);
CREATE INDEX idx_shipment_order     ON shipment(order_id);

-- ------------------------------------------------------------
-- Fidelizacion
-- ------------------------------------------------------------
CREATE INDEX idx_loyalty_buyer      ON loyalty_transaction(buyer_id, created_at DESC);

CREATE INDEX idx_review_product
  ON review(product_id)
  WHERE is_approved = true;

CREATE INDEX idx_wishlist_buyer     ON wishlist_item(buyer_id);

CREATE INDEX idx_follower_artisan   ON artisan_follower(artisan_id);
CREATE INDEX idx_follower_buyer     ON artisan_follower(buyer_id);

-- ------------------------------------------------------------
-- Contenido y notificaciones
-- ------------------------------------------------------------
CREATE INDEX idx_blog_published
  ON blog_post(published_at DESC)
  WHERE status = 'published';

CREATE INDEX idx_blog_slug          ON blog_post(slug);

CREATE INDEX idx_seo_entity         ON seo_meta(entity_type, entity_id);

CREATE INDEX idx_notif_user_unread
  ON notification(user_id, created_at DESC)
  WHERE is_read = false;

-- ------------------------------------------------------------
-- Configuracion
-- ------------------------------------------------------------
CREATE INDEX idx_commission_recent  ON commission_config(effective_from DESC);
CREATE INDEX idx_coupon_code        ON coupon(code) WHERE is_active = true;

-- ------------------------------------------------------------
-- Webhook idempotency
-- ------------------------------------------------------------
CREATE INDEX idx_webhook_event_source ON webhook_event(source, processed_at DESC);
