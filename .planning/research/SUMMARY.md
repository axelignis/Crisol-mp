# Project Research Summary

**Project:** Crisol — Marketplace de orfebrería artesanal
**Domain:** Multi-vendor artisanal jewelry marketplace (LATAM/Chile, bilingual)
**Researched:** 2026-04-12
**Confidence:** HIGH

## Executive Summary

Crisol is a curated multi-vendor marketplace for handcrafted jewelry, combining a unified brand identity with individual artisan storytelling. The research confirms that successful platforms in this domain (Novica, Etsy) differentiate on curation quality, visual trust signals, and seamless checkout — not on feature breadth. The recommended approach is a server-first Next.js architecture with Supabase RLS enforcing all access control, Stripe Connect handling automated commission splits, and four courier integrations providing real-time shipping quotes. The core stack is already locked and well-chosen; what remains is adding targeted libraries (react-hook-form, shadcn/ui, nuqs, sonner) and building out four vertical tiers: Foundation, Catalog, Commerce, Operations.

The biggest architectural decision — and the one with the most failure modes — is the payment pipeline. CLP is a zero-decimal currency in Stripe, split payment requires Stripe Connect onboarding before any sale can process, and webhook idempotency is non-negotiable. These three constraints must be baked into foundations in Phase 1 before any commerce feature is built. The checkout flow cannot be incrementally assembled: Cart → Checkout → Payment → Shipping are tightly coupled and should be delivered as a single phase.

The main risk to the project is building in the wrong order. Auth and RLS policies must be validated with real JWTs (not SQL Editor) before any protected feature is built. ISR pages must use tag-based revalidation from the first page. State machine transition functions must live in the database, not in application logic. Shortcuts here produce HIGH-recovery-cost failures (double payouts, exposed draft products, corrupted order states) that are difficult to undo.

## Key Findings

### Recommended Stack

The existing stack is production-ready and requires no re-evaluation. The meaningful additions are: react-hook-form + @hookform/resolvers for form-heavy artisan/admin panels; shadcn/ui (CLI-based component copy) for accessible UI primitives; nuqs for type-safe URL filter state on catalog pages; sonner for toast feedback; and date-fns for date formatting. Courier integrations (Chilexpress, Starken, DHL, FedEx) must be built as custom thin clients — no reliable npm wrappers exist. State machines for order and piece lifecycle should be plain TypeScript transition maps, not XState (overkill for two linear machines). The one version risk: @supabase/supabase-js is on 2.45.4 and should be bumped to ^2.103.0.

**Core technologies (additions to locked stack):**
- react-hook-form + @hookform/resolvers: form state for 15+ field piece creation — avoids re-renders, reuses Zod schemas
- shadcn/ui (CLI v4): accessible component primitives (table, dialog, sheet, command) — no runtime overhead
- nuqs ^2.4.0: URL-serialized catalog filter state — SSR-compatible, type-safe, shareable links
- sonner ^2.0.7: toast notifications — promise-based, native shadcn integration
- date-fns ^4.1.0: tree-shakeable date formatting for order timestamps and dashboard ranges
- @google/model-viewer ^4.2.0: 3D piece viewer web component — lazy load via next/dynamic (v1.x)
- recharts ^2.15.0: admin dashboard charts (sales, commissions, order distribution)
- Custom courier clients in src/lib/couriers/: unified CourierProvider interface over 4 REST APIs

**What NOT to use:** Prisma/Drizzle (bypass RLS), NextAuth (conflicts with Supabase Auth), XState (overkill), Zod v4 (resolver compatibility issue confirmed).

### Expected Features

**Must have (table stakes — v1 launch):**
- Product catalog with faceted filtering (type, material, price, occasion) — broken discovery without it
- High-quality product imagery with Cloudinary optimization — jewelry is a visual purchase
- Artisan public profiles with storytelling — 78% of handmade buyers pay premium for narrative
- Secure checkout with guest option — forcing registration loses 25-35% of buyers
- Stripe Connect split payment with automatic commission — core business model
- Order lifecycle state machine (pending_payment → paid → in_preparation → shipped → delivered)
- Real-time shipping quotes from Chilexpress + Starken (national couriers) — cost is a top purchase factor
- Admin approval workflow (draft → pending_review → published) — curation is Crisol's differentiator
- Artisan dashboard (products, orders, balance/commission view) — self-service or support burden grows
- Admin dashboard (approvals, artisan management, reports, commission config) — platform operation
- Role-based access control (admin, artisan, buyer) enforced via Supabase RLS + JWT claims
- Product variants (size, material, color with stock/price modifiers) — essential for jewelry domain
- Transactional emails via Resend (order confirmation, status changes, approval/rejection)
- Commission config with version history — business model cannot be hardcoded

**Should have (add post-launch when conditions are met):**
- Coupons and promotions (RF-18) — add when marketing campaigns begin
- International shipping: DHL + FedEx — add when international demand is confirmed
- 3D model viewer — add when artisans produce 3D assets
- CLP/USD display toggle — add when international traffic justifies it
- English locale content — add when translations are written

**Defer (v2+):**
- Loyalty points/membership tiers — requires purchase volume data
- Verified reviews — requires completed orders at scale
- Commission slots for custom orders — validate demand first
- Blog/CMS — requires editorial commitment
- Coinbase Commerce crypto payments — marginal buyer segment, high reconciliation complexity
- Native mobile app — PWA-capable responsive web covers v1 needs

**Anti-features to reject:** Real-time buyer-artisan chat, OAuth social login at launch, AI recommendations (cold start), auction/bidding, multi-channel inventory sync.

### Architecture Approach

The architecture is a server-first Next.js monolith with selective client islands. Public store pages use SSG/ISR with tag-based revalidation; artisan and admin dashboards use SSR with server actions and role guards; cart is the only significant client-side state (Zustand + localStorage). The middleware layer handles session refresh (Supabase SSR) and locale routing (next-intl) at the edge. All payment state transitions are driven exclusively by verified Stripe webhooks — never by client polling or optimistic updates. Order status is decomposed: one ORDER has multiple SHIPMENT records (one per artisan), enabling independent fulfillment tracking.

**Major components:**
1. Public Store (`[locale]/*`) — SSG/ISR catalog, product detail, artisan profiles; SEO-critical
2. Artisan Dashboard (`artesano/*`) — piece CRUD, order fulfillment, balance view; SSR + server actions, role-guarded
3. Admin Panel (`admin/*`) — piece moderation, artisan management, config, reports; SSR + server actions
4. Catalog Module (`lib/`) — product queries, variant management, media, search/filter
5. Commerce Module (`lib/`) — cart-to-order, coupon application, commission calculation
6. Payments Module (`lib/stripe/`) — Stripe Connect split payment, webhook handler, idempotency
7. Shipping Module (`lib/couriers/`) — unified interface over 4 courier APIs with graceful degradation
8. Client State — Zustand cart (localStorage) + currency preference (cookie)

**Key patterns:** Server-first RSC with client islands only for interactive elements; webhook-driven order state machine; commission-config-driven split (never hardcoded); multi-artisan order decomposition with per-artisan shipment records.

### Critical Pitfalls

1. **CLP zero-decimal in Stripe** — CLP has no subunit; never multiply by 100. Build `toCents(currency, amount)` utility in `lib/utils/currency.ts` from day one. Unit test: `toCents('CLP', 50000) === 50000`. A 100x overcharge on first transaction is catastrophic.

2. **RLS silent empty results** — RLS enabled tables with missing policies return zero rows without errors. Development works fine (SQL Editor runs as superuser). Integration test every table with real JWTs for each role before declaring auth done.

3. **Webhook double-processing** — Stripe retries webhooks for 3 days. Store `event.id` in `webhook_events` table with UNIQUE constraint. Check idempotency before any state transition or transfer. Cannot be bolted on after first handler is written.

4. **State machine allowing invalid transitions** — Without a Postgres transition function, any UPDATE can skip states. Unreviewed products appear in catalog; unpaid orders get shipped. Enforce transitions in a DB function with `SELECT ... FOR UPDATE` to prevent races.

5. **RLS `auth.uid()` performance** — Naive `USING (user_id = auth.uid())` re-evaluates per row. Wrap with `USING (user_id = (SELECT auth.uid()))` to trigger InitPlan caching. Retrofitting 22 tables of policies is painful — establish the pattern in migration 1.

6. **CDN caching Supabase auth tokens** — ISR pages with `Set-Cookie` headers can be cached and served to wrong users. Use `force-dynamic` on all auth-reading pages; restrict middleware matcher to exclude static assets.

7. **Multi-courier failure at checkout** — Use `Promise.allSettled()` with 3-second timeouts; flat-rate fallback when a provider is unreachable. Sequential calls block the entire checkout on a single slow courier.

## Implications for Roadmap

Based on combined research findings and the explicit build order from ARCHITECTURE.md:

### Phase 1: Foundation
**Rationale:** Every feature depends on a correct schema with RLS, validated auth, and foundational utilities. Errors here (wrong CLP handling, missing RLS policies, incorrect auth.uid() pattern) propagate into every downstream feature with HIGH recovery cost. Must be validated with real JWTs before any feature is built on top.
**Delivers:** 22-table schema with RLS + policies; auth with role guards; Supabase client factories; commission.ts with CLP-safe arithmetic; currency.ts; order/piece state machine transition functions in DB; middleware with correct caching headers.
**Addresses features:** Role-based access control, commission config.
**Avoids pitfalls:** CLP zero-decimal, RLS silent results, RLS auth.uid() performance, CDN auth token caching, commission rounding, state machine violations, views bypassing RLS.
**Research flag:** Standard patterns — no additional phase research needed.

### Phase 2: Catalog
**Rationale:** Buyers need something to discover before any purchase flow is relevant. The admin approval workflow creates the first observable end-to-end user journey. ISR revalidation strategy (tag-based) must be established here before any cached pages exist.
**Delivers:** Product CRUD (artisan side) with variants and Cloudinary media upload; admin approval workflow (draft → pending_review → published); public catalog with ISR, faceted filters (nuqs), product detail pages, artisan profiles with SEO metadata + JSON-LD.
**Addresses features:** Product catalog with filtering, high-quality imagery, product variants, admin approval workflow, artisan public profiles.
**Avoids pitfalls:** ISR multi-instance staleness (use revalidateTag from first page), N+1 catalog queries.
**Research flag:** Standard patterns — ISR + Supabase + nuqs filter pattern is well-documented.

### Phase 3: Commerce (Checkout + Payments + Shipping)
**Rationale:** Cart, checkout, payment, and shipping are tightly coupled and must be delivered as a unit. Stripe Connect artisan onboarding must exist before any payment can process. Cannot be built incrementally without orphaned flows.
**Delivers:** Zustand cart with guest support; Stripe Connect artisan onboarding; checkout server action (Zod-validated, server-side price calculation); Stripe PaymentIntent with split payment; webhook handler with idempotency table; national courier integration (Chilexpress + Starken) with Promise.allSettled + fallback; order lifecycle state machine; coupon application at checkout.
**Addresses features:** Cart, checkout, split payment, national shipping, order lifecycle, coupons.
**Avoids pitfalls:** Webhook double-processing (idempotency table), CLP zero-decimal in PaymentIntent, courier failure at checkout, client-side order creation anti-pattern.
**Research flag:** Stripe Connect Express account availability in Chile needs confirmation. Chilexpress/Starken API authentication and sandbox access require hands-on verification.

### Phase 4: Operations (Dashboards + Email + Fulfillment)
**Rationale:** Fulfillment and reporting are only useful once orders exist. Email notifications are additive. Artisan and admin dashboards close the loop on self-service and platform operation.
**Delivers:** Artisan dashboard (products, orders, balance, commission breakdown); admin dashboard (approval queue, artisan management, revenue reports with recharts, commission config UI); artisan order management (mark in_preparation, mark shipped); buyer order history and tracking; transactional email templates via Resend.
**Addresses features:** Artisan dashboard, admin dashboard, transactional emails, order management.
**Avoids pitfalls:** Email blocking webhook response (enqueue, return 200 first).
**Research flag:** Standard patterns — dashboard + recharts + Resend/React Email well-documented.

### Phase 5: Internationalization + Post-Launch Features
**Rationale:** i18n architecture is already scaffolded. Content translation and international shipping are gated by real conditions (international traffic confirmed, 3D assets available, marketing campaigns starting).
**Delivers:** English locale content; CLP/USD display toggle; international shipping (DHL + FedEx); 3D model viewer (@google/model-viewer, lazy-loaded); coupons if not included in Phase 3.
**Addresses features:** CLP/USD display, English locale, international shipping, 3D viewer.
**Research flag:** DHL and FedEx Chile-origin REST API authentication and sandbox environments need verification before committing to timeline.

### Phase Ordering Rationale

- Foundation before everything: 22-table schema and RLS are referenced by every module. CLP currency utility, state machine functions, and auth.uid() pattern established here prevent compounding errors across all downstream phases.
- Catalog before Commerce: Artisans must list products before checkout is testable. Admin approval creates the first observable user journey and validates the content pipeline.
- Commerce as atomic unit: Cart → Checkout → Payment → Shipping share data contracts. Stripe Connect onboarding gates all payment tests. Building in isolation creates orphaned, untestable flows.
- Operations after first orders: Dashboards and reporting are only meaningful with real data. Transactional emails enhance flows but do not enable them.
- Post-launch features gated by real conditions, not technical readiness: i18n content and international shipping require confirmed demand.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (Commerce):** Stripe Connect Express vs Custom account availability for Chilean artisans — confirm with Stripe before designing onboarding. Chilexpress and Starken REST API authentication (API key format, sandbox availability) requires hands-on testing before implementation begins.
- **Phase 5 (International):** DHL and FedEx Chile-origin shipment REST API credentials and sandbox environments need verification.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Supabase RLS patterns, Next.js middleware, and CLP Stripe handling are thoroughly documented in official sources.
- **Phase 2 (Catalog):** ISR + nuqs + Cloudinary patterns are well-established in the Next.js App Router ecosystem.
- **Phase 4 (Operations):** Dashboard + recharts + Resend/React Email patterns are standard with abundant documentation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core stack locked via ADR. New additions verified against npm + official docs. One version gap: @supabase/supabase-js needs bump from 2.45.4 to ^2.103.0. |
| Features | HIGH | Research draws from official project docs (RF-01 to RF-19, 30 use cases) plus competitor analysis. MVP scope is well-bounded. |
| Architecture | HIGH | Build order and component boundaries derived from project's own architecture docs + official Stripe/Supabase/Next.js documentation. |
| Pitfalls | HIGH | All critical pitfalls verified via official docs (Stripe currency list, Supabase RLS performance guide, Next.js ISR issues). Recovery costs documented. |

**Overall confidence:** HIGH

### Gaps to Address

- **Stripe Connect Express in Chile:** Confirm Chile is in Express account supported regions before building artisan onboarding. If not, Custom accounts require significantly more implementation work.
- **Chilexpress/Starken sandbox access:** Request sandbox credentials early — their developer documentation is not fully publicly verified. Blocking risk for Phase 3.
- **DHL/FedEx Chile-origin REST API:** Confirm Chile-origin support in REST APIs (not legacy SOAP) before committing Phase 5 timeline.
- **@supabase/supabase-js version bump:** Should be the first commit. Verify no breaking changes in auth cookie handling with @supabase/ssr before proceeding.
- **Zod v4 migration timing:** Stay on v3.23.8 until @hookform/resolvers issue #4992 resolves. Monitor upstream.

## Sources

### Primary (HIGH confidence)
- Crisol project docs (`docs/master.html`, `.planning/PROJECT.md`, `docs/erd_core.html`, `docs/flow_purchase.html`, `docs/flow_split_payment.html`) — requirements, data model, flows
- [Stripe: Supported currencies](https://docs.stripe.com/currencies) — CLP zero-decimal confirmation
- [Stripe: Webhooks](https://docs.stripe.com/webhooks) — retry behavior, idempotency
- [Stripe: Connect documentation](https://docs.stripe.com/connect) — split payment, Express accounts
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS patterns
- [Supabase: RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — auth.uid() InitPlan pattern
- [Supabase: Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — middleware patterns
- [Next.js: ISR Guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration) — revalidateTag vs revalidatePath
- [nuqs](https://nuqs.dev/) — Next.js >=14.2.0 URL state compatibility confirmed
- [npm: react-hook-form](https://www.npmjs.com/package/react-hook-form) — v7.72.1
- [npm: @hookform/resolvers](https://www.npmjs.com/package/@hookform/resolvers) — Zod v4 compatibility issue confirmed

### Secondary (MEDIUM confidence)
- [Where to Buy Handmade Jewelry: 11 Top Sites & Trends 2026](https://lefkarasilver.com/handmade-jewelry/) — competitor landscape
- [40 Essential Features for a Multi Vendor Marketplace](https://www.shipturtle.com/blog/features-to-build-multi-vendor-marketplace) — feature checklist
- [Building a Scalable Multi-Vendor Marketplace: Technical Architecture 2026](https://needlecode.com/blog/web-dev/building-scalable-multi-vendor-marketplace.html) — architectural patterns
- [Hookdeck: Implementing webhook idempotency](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency) — idempotency patterns

### Tertiary (needs validation during implementation)
- [Chilexpress Developer Portal](https://developers.wschilexpress.com/) — API shape confirmed, sandbox access unverified
- Stripe Connect Express availability for Chilean artisan accounts — not explicitly confirmed in docs

---
*Research completed: 2026-04-12*
*Ready for roadmap: yes*
