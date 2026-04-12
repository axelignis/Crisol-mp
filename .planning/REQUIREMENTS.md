# Requirements: Crisol

**Defined:** 2026-04-12
**Core Value:** Un comprador puede descubrir, explorar y comprar piezas artesanales únicas con pago seguro y despacho directo del artesano.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [ ] **FOUND-01**: Database schema completo (22 entidades) con migraciones forward-only en Supabase
- [ ] **FOUND-02**: RLS activo en toda tabla con políticas por rol (admin, artisan, buyer)
- [ ] **FOUND-03**: Funciones de transición de estado en PostgreSQL con row locks (product y order state machines)
- [ ] **FOUND-04**: Utilidad CLP como moneda zero-decimal (aritmética de enteros, sin floating point)
- [ ] **FOUND-05**: Commission.ts con cálculo entero donde comisión + neto artesano = total exacto
- [ ] **FOUND-06**: Tabla de idempotencia para webhooks (event.id → processed)

### Authentication

- [ ] **AUTH-01**: User puede registrarse con email y contraseña vía Supabase Auth
- [ ] **AUTH-02**: User recibe verificación de email tras registro
- [ ] **AUTH-03**: User puede recuperar contraseña vía email
- [ ] **AUTH-04**: Sesión persiste entre refreshes del navegador (middleware Supabase)
- [ ] **AUTH-05**: Guards por rol en layouts: /artesano requiere rol artisan, /admin requiere rol admin
- [ ] **AUTH-06**: JWT claims incluyen rol del usuario para RLS

### Catalog

- [ ] **CATL-01**: Artesano puede crear pieza con tipo (única, serie, arte decorativo), título, descripción y precio en CLP
- [ ] **CATL-02**: Artesano puede crear variantes por pieza (talla, material, color, piedras) con stock y modificador de precio
- [ ] **CATL-03**: Artesano puede subir hasta 10 fotos (JPG/PNG/WebP) con auto-conversión WebP/AVIF vía Cloudinary
- [ ] **CATL-04**: Artesano puede definir foto de portada y ordenar galería
- [ ] **CATL-05**: Pieza nueva entra en estado draft; artesano la envía a revisión (pending_review)
- [ ] **CATL-06**: Admin puede aprobar (published), solicitar cambios (changes_requested) o rechazar (rejected) una pieza
- [ ] **CATL-07**: Artesano recibe notificación email del resultado de revisión
- [ ] **CATL-08**: Solo piezas en estado published son visibles en el catálogo público
- [ ] **CATL-09**: Piezas vendidas permanecen visibles como portafolio del artesano (estado sold)
- [ ] **CATL-10**: Admin puede gestionar categorías y tags jerárquicos
- [ ] **CATL-11**: Ediciones menores de piezas publicadas se publican directamente sin re-aprobación

### Discovery

- [ ] **DISC-01**: Visitante puede explorar catálogo público con páginas SSG/ISR
- [ ] **DISC-02**: Visitante puede filtrar por tipo de pieza, material, rango de precio, ocasión y técnica
- [ ] **DISC-03**: Visitante puede ver perfil público de artesano con URL amigable (/artesano/slug)
- [ ] **DISC-04**: Visitante puede ver detalle de pieza con galería, variantes y precio
- [ ] **DISC-05**: Cambios en pieza/artesano disparan revalidación ISR on-demand
- [ ] **DISC-06**: Páginas de producto y artesano incluyen generateMetadata para SEO básico

### Commerce

- [ ] **COMR-01**: Visitante (invitado o registrado) puede agregar piezas al carrito (Zustand, persistido en localStorage)
- [ ] **COMR-02**: Carrito soporta piezas de múltiples artesanos en una sola orden
- [ ] **COMR-03**: Checkout muestra aviso explícito de política de no devoluciones antes de confirmar
- [ ] **COMR-04**: Checkout solicita dirección de envío y muestra cotización automática de courier
- [ ] **COMR-05**: Cotización de envío con Chilexpress y Starken (nacional) con timeout y fallback a tarifa plana
- [ ] **COMR-06**: Pago con tarjeta vía Stripe Connect con split automático (comisión → admin, neto → artesano)
- [ ] **COMR-07**: Webhook Stripe verifica firma y procesa con idempotencia por event.id
- [ ] **COMR-08**: Pedido se crea al confirmar pago con snapshot inmutable de título y precio por item
- [ ] **COMR-09**: Aviso de impuestos internacionales visible en checkout (disclaimer legal)

### Order Lifecycle

- [ ] **ORDR-01**: Pedido sigue estado estricto: pending_payment → paid → in_preparation → shipped → delivered (+ cancelled)
- [ ] **ORDR-02**: Artesano puede avanzar estado de pedido (paid → in_preparation → shipped con tracking)
- [ ] **ORDR-03**: Comprador puede ver historial de pedidos con estado actual
- [ ] **ORDR-04**: Cada cambio de estado genera email transaccional al comprador (Resend)
- [ ] **ORDR-05**: Artesano recibe email de nuevo pedido y cambios relevantes
- [ ] **ORDR-06**: Shipment registra courier, número de tracking y estados de envío por artesano

### Artisan Panel

- [ ] **ARTP-01**: Artesano puede gestionar sus piezas (crear, editar, enviar a revisión)
- [ ] **ARTP-02**: Artesano puede ver lista de pedidos propios con estado
- [ ] **ARTP-03**: Artesano puede ver balance neto personal y comisiones descontadas
- [ ] **ARTP-04**: Artesano puede editar su perfil público (bio, foto, redes sociales)
- [ ] **ARTP-05**: Artesano puede ver notificaciones de aprobación/rechazo y nuevos pedidos

### Admin Panel

- [ ] **ADMN-01**: Admin puede aprobar/rechazar piezas pendientes de revisión
- [ ] **ADMN-02**: Admin puede gestionar artesanos (activar, desactivar, ver perfil)
- [ ] **ADMN-03**: Admin puede configurar comisión % y umbral de envío gratis (COMMISSION_CONFIG versionada)
- [ ] **ADMN-04**: Admin puede ver reportería básica: ventas totales, comisiones acumuladas, pedidos por estado
- [ ] **ADMN-05**: Admin puede gestionar cupones de descuento (crear, editar, desactivar)
- [ ] **ADMN-06**: Admin puede gestionar categorías y tags del catálogo

### Coupons

- [ ] **COUP-01**: Admin puede crear cupón con tipo (porcentaje o monto fijo), límite de usos y fecha de expiración
- [ ] **COUP-02**: Comprador puede aplicar código de cupón en checkout
- [ ] **COUP-03**: Sistema valida vigencia, límite de usos y reglas del cupón antes de aplicar descuento

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Loyalty & Engagement

- **LOYL-01**: Comprador acumula 1 punto por compra completada
- **LOYL-02**: Dos niveles de membresía con umbral y beneficios configurables desde admin
- **LOYL-03**: Canje de puntos como descuento directo en carrito
- **LOYL-04**: Comprador puede guardar piezas en favoritos
- **LOYL-05**: Comprador puede seguir artesanos y recibir notificaciones de novedades
- **LOYL-06**: Reseñas verificadas (solo compradores con pedido completado) con moderación admin

### Content & Marketing

- **CONT-01**: Blog editorial gestionable desde admin con soporte IA
- **CONT-02**: Web Push notifications para artesanos y compradores
- **CONT-03**: Pinterest Shopping feed sincronizado
- **CONT-04**: Instagram Shopping integration

### Payments & International

- **INTL-01**: Coinbase Commerce como método de pago alternativo (cripto)
- **INTL-02**: Multi-moneda CLP/USD con conversión en tiempo real
- **INTL-03**: Internacionalización inglés activada con contenido traducido
- **INTL-04**: Integración DHL + FedEx para envío internacional
- **INTL-05**: Slots de encargo con pago completo al confirmar (commission slots)

### SEO & Analytics

- **SEOA-01**: Schema.org completo (Product, BreadcrumbList, Person, FAQPage, Organization, BlogPosting)
- **SEOA-02**: GA4 + Search Console API integrada en panel admin
- **SEOA-03**: llms.txt + FAQ + glosario AEO para answer engine optimization
- **SEOA-04**: Lighthouse CI como gate en pipeline de deploy

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| App nativa móvil | Web responsive cubre 95% de casos. Costo 2-3x sin justificación. |
| Chat en tiempo real | WebSockets + moderación + siempre-online para 4-6 artesanos = peor UX que email. |
| OAuth social login | Email/password suficiente para marketplace nicho. Agregar en v2 si conversion data lo justifica. |
| Subasta/bidding | Incompatible con posicionamiento de precio fijo curado. Custom orders vía commission slots. |
| Recomendaciones IA | Cold start severo con <100 SKUs y 4-6 artesanos. Usar "piezas del mismo artesano" por atributos. |
| Multi-canal (Etsy sync) | Sync de inventario es un producto entero. Artesanos manejan manualmente si venden en otro canal. |
| Motor de reglas de descuento complejas | Un cupón por orden, sin stacking. Reglas complejas son inmantenibles para escala actual. |
| Contenido generado por usuarios (fotos) | Carga de moderación y storage. Mejor curar "spotlight" desde admin. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Pending |
| FOUND-06 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Pending |
| CATL-01 | Phase 2 | Pending |
| CATL-02 | Phase 2 | Pending |
| CATL-03 | Phase 2 | Pending |
| CATL-04 | Phase 2 | Pending |
| CATL-05 | Phase 2 | Pending |
| CATL-06 | Phase 2 | Pending |
| CATL-07 | Phase 2 | Pending |
| CATL-08 | Phase 2 | Pending |
| CATL-09 | Phase 2 | Pending |
| CATL-10 | Phase 2 | Pending |
| CATL-11 | Phase 2 | Pending |
| DISC-01 | Phase 2 | Pending |
| DISC-02 | Phase 2 | Pending |
| DISC-03 | Phase 2 | Pending |
| DISC-04 | Phase 2 | Pending |
| DISC-05 | Phase 2 | Pending |
| DISC-06 | Phase 2 | Pending |
| COMR-01 | Phase 3 | Pending |
| COMR-02 | Phase 3 | Pending |
| COMR-03 | Phase 3 | Pending |
| COMR-04 | Phase 3 | Pending |
| COMR-05 | Phase 3 | Pending |
| COMR-06 | Phase 3 | Pending |
| COMR-07 | Phase 3 | Pending |
| COMR-08 | Phase 3 | Pending |
| COMR-09 | Phase 3 | Pending |
| ORDR-01 | Phase 4 | Pending |
| ORDR-02 | Phase 4 | Pending |
| ORDR-03 | Phase 4 | Pending |
| ORDR-04 | Phase 4 | Pending |
| ORDR-05 | Phase 4 | Pending |
| ORDR-06 | Phase 4 | Pending |
| ARTP-01 | Phase 5 | Pending |
| ARTP-02 | Phase 5 | Pending |
| ARTP-03 | Phase 5 | Pending |
| ARTP-04 | Phase 5 | Pending |
| ARTP-05 | Phase 5 | Pending |
| ADMN-01 | Phase 5 | Pending |
| ADMN-02 | Phase 5 | Pending |
| ADMN-03 | Phase 5 | Pending |
| ADMN-04 | Phase 5 | Pending |
| ADMN-05 | Phase 5 | Pending |
| ADMN-06 | Phase 5 | Pending |
| COUP-01 | Phase 3 | Pending |
| COUP-02 | Phase 3 | Pending |
| COUP-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 58 total
- Mapped to phases: 58
- Unmapped: 0

---
*Requirements defined: 2026-04-12*
*Last updated: 2026-04-12 after roadmap creation*
