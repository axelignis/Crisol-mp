# Crisol

## What This Is

Crisol es un marketplace e-commerce multivvendedor de joyería artesanal, orfebrería y arte decorativo elaborado por miembros de una familia. Opera bajo marca híbrida: identidad unificada Crisol con perfiles de autor visibles por artesano. El administrador (desarrollador del sistema) percibe comisión fija automática por cada venta vía Stripe Connect.

## Core Value

Un comprador puede descubrir, explorar y comprar piezas artesanales únicas con pago seguro y despacho directo del artesano — el flujo compra completa → split payment → despacho debe funcionar sin fricción.

## Requirements

### Validated

- ✓ Scaffold Next.js 14 App Router con rutas por rol (público, artesano, admin) — existing
- ✓ Supabase configurado (Auth + Storage + config.toml) — existing
- ✓ Internacionalización base con next-intl (es default, en) — existing
- ✓ Estructura de carpetas por dominio (components, lib, store, hooks) — existing
- ✓ Tailwind CSS + PostCSS configurado — existing
- ✓ Zustand para estado cliente (cart, currency) — existing
- ✓ Vitest + Playwright configurados — existing
- ✓ Lighthouse CI configurado — existing
- ✓ Middleware de sesión Supabase + i18n — existing

### Active

- [ ] Migraciones SQL completas (22 entidades, RLS por tabla)
- [ ] Autenticación con roles (admin, artisan, buyer) + guards por layout
- [ ] Gestión de productos: piezas únicas, en serie, por encargo, arte decorativo
- [ ] Multimedia por pieza: hasta 10 fotos, 1 video, 1 modelo 3D (Cloudinary + model-viewer)
- [ ] Flujo de publicación: draft → pending_review → published (+ changes_requested, rejected, sold)
- [ ] Catálogo público con SSG/ISR: filtros por tipo, material, precio, ocasión, técnica
- [ ] Perfil público de artesano con URL amigable
- [ ] Panel del artesano: gestión de piezas, slots, ventas, balance, comisiones
- [ ] Carrito + checkout (invitados y registrados) con aviso no-devoluciones
- [ ] Pagos: Stripe Connect (tarjeta) + split payment automático (comisión configurable)
- [ ] Integración couriers: Chilexpress + Starken (nacional), DHL + FedEx (internacional)
- [ ] Ciclo de pedido: pending_payment → paid → in_preparation → shipped → delivered (+ cancelled)
- [ ] Email transaccional con Resend + React Email
- [ ] Panel admin: aprobación de piezas, gestión artesanos, catálogo, reportería básica
- [ ] COMMISSION_CONFIG versionada: comisión %, umbral envío gratis, configurable desde admin
- [ ] Cupones y promociones: código descuento (% o monto fijo), límite de usos, expiración
- [ ] Variantes de producto: talla, material, color, piedras con stock y modificador de precio
- [ ] Cotización de envío automática en checkout
- [ ] Configuración global editable desde admin

### Out of Scope

- Sistema de puntos y membresía — v2 (Fase 3)
- Reseñas verificadas y moderación — v2 (Fase 3)
- Favoritos y seguimiento de artesanos — v2 (Fase 3)
- Slots de encargo con pago — v2 (Fase 3)
- Blog editorial + asistente IA — v2 (Fase 3)
- Web Push notifications — v2 (Fase 3)
- Coinbase Commerce (cripto) — v2 (Fase 3)
- Schema.org completo — v2 (Fase 4)
- GA4 + Search Console API en admin — v2 (Fase 4)
- Pinterest Shopping / Instagram Shopping — v2 (Fase 4)
- llms.txt + FAQ + glosario AEO — v2 (Fase 4)
- Multi-moneda CLP/USD en tiempo real — v2 (Fase 4)
- Internacionalización inglés activada — v2 (Fase 4)
- App nativa móvil — sin planes
- Chat en tiempo real — complejidad alta, no es core
- OAuth login (Google, GitHub) — email/password suficiente para v1
- Video posts — costos de storage/bandwidth

## Context

- **Modelo de negocio**: Marketplace familiar con 4-6 artesanos iniciales, escalable sin refactorización.
- **Mercado**: Internacional desde lanzamiento. Web responsive únicamente.
- **Moneda canónica**: CLP. USD es display-only vía /api/currency, no se persiste.
- **Política**: Sin devoluciones (aviso explícito en checkout). Impuestos internacionales = aviso legal por ahora.
- **Artesanos**: Cada uno despacha sus propias piezas. Onboarding Stripe Connect pendiente de definir flujo.
- **Piezas vendidas**: Permanecen visibles como portafolio del artesano.
- **Codebase existente**: Scaffold completo con rutas, middleware, stores, libs por dominio, testing framework. Falta lógica de negocio y migraciones.
- **Documentación completa**: master.html con 19 RF, 30 UC, 22 entidades ERD, 3 flujos críticos, 6 ADR.
- **Plazo**: Sin fecha fija — calidad sobre velocidad.
- **Presupuesto**: Servicios pagados justificados; low-cost al inicio.

## Constraints

- **Tech stack**: Next.js 14 App Router + Supabase + Stripe Connect + Cloudinary + Resend — decidido (ADR-001 a ADR-004)
- **Security**: RLS activo en toda tabla; service_role key solo server-side. Pagos PCI-compliant vía Stripe.
- **Data model**: USER como tabla base única para todos los roles (ADR-005). SEO_META polimórfica (ADR-006).
- **i18n**: next-intl con es default. Locale es obligatorio; en puede estar incompleto pero su estructura debe existir.
- **Media**: Uploads solo vía firma Cloudinary desde /api/upload. Máximo 10 fotos por producto.
- **Webhooks**: Stripe/Coinbase deben verificar firma e idempotencia por event.id.
- **Commission**: Usar lib/utils/commission.ts con % vigente en config. Nunca hardcodear.
- **State machine**: Estados de pieza y pedido son estrictos — no saltar estados.
- **Git**: Ramas protegidas (main, develop, qa, uat). Feature branches desde develop.
- **Testing**: Todo feature nuevo requiere tests E2E en Playwright.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase como backend principal (ADR-001) | Auth + DB + Storage + RLS en un solo servicio. Reduce config y costos. | ✓ Good |
| Stripe Connect para split payments (ADR-002) | Único gateway con split nativos y PCI Level 1 para marketplace LATAM. | ✓ Good |
| Next.js 14 App Router con ISR (ADR-003) | SSG/ISR crítico para SEO catálogo. RSC reduce JS cliente. | ✓ Good |
| Cloudinary para multimedia (ADR-004) | Conversión auto WebP/AVIF para Core Web Vitals sin código extra. | ✓ Good |
| USER tabla base única (ADR-005) | Permite dual-role (artesano+comprador) sin duplicar auth. | ✓ Good |
| SEO_META polimórfica (ADR-006) | Centraliza metadatos SEO de cualquier entidad en una tabla. | ✓ Good |
| v1 = Fases 1-2 (Fundaciones + MVP Core) | Foco en flujo de compra funcional antes de fidelización/SEO. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-12 after initialization*
