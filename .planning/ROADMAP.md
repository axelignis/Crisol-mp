# Roadmap: Crisol

## Overview

Crisol delivers a curated artisanal jewelry marketplace in five phases: a data foundation with auth and RLS, a catalog with artisan product management and public discovery, an atomic commerce flow (cart through payment and shipping), post-payment order lifecycle and fulfillment, and finally the artisan and admin dashboards that close the operational loop. Each phase delivers a verifiable capability; no phase is useful without its predecessors.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Auth** - Database schema, RLS policies, authentication with role guards, and core utilities
- [ ] **Phase 2: Catalog & Discovery** - Product creation with variants, approval workflow, public catalog with SSG/ISR and filtering
- [ ] **Phase 3: Commerce** - Cart, checkout, Stripe Connect split payment, courier quotes, and coupons
- [ ] **Phase 4: Order Lifecycle** - Order state machine, artisan fulfillment, shipment tracking, and transactional emails
- [ ] **Phase 5: Dashboards & Operations** - Artisan panel, admin panel, reporting, and platform configuration

## Phase Details

### Phase 1: Foundation & Auth
**Goal**: Every table exists with enforced RLS, users can register and authenticate with role-based access, and core utilities (CLP arithmetic, commission calculation, state machines, webhook idempotency) are validated
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):
  1. A new user can register with email/password, receive a verification email, and log in with a persisted session
  2. A user with role "artisan" can access /artesano routes; a user with role "admin" can access /admin routes; unauthorized users are redirected
  3. RLS policies return correct data for each role when queried with real JWTs (not superuser) — verified by integration tests on every table
  4. Commission calculation produces integer CLP values where commission + artisan net = exact total, with no floating-point artifacts
  5. State machine transition functions in PostgreSQL reject invalid state changes and use row locks to prevent race conditions
**Plans**: 4 plans

Plans:
- [ ] 01-01-PLAN.md — Database schema rewrite: 12 migrations with Stripe Connect, INTEGER CLP, RLS, state machines, auth hook
- [ ] 01-02-PLAN.md — Core TypeScript utilities: CLP integer arithmetic and commission split calculation (TDD)
- [ ] 01-03-PLAN.md — Auth pages with split-screen layout, callback route, layout guard fixes, type regeneration
- [ ] 01-04-PLAN.md — E2E Playwright tests for auth flows: registration, login, recovery, role guards

### Phase 2: Catalog & Discovery
**Goal**: Artisans can create and manage pieces with variants and media, admins can moderate submissions, and visitors can browse a public catalog with filtering, product detail, and artisan profiles
**Depends on**: Phase 1
**Requirements**: CATL-01, CATL-02, CATL-03, CATL-04, CATL-05, CATL-06, CATL-07, CATL-08, CATL-09, CATL-11, DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06
**Success Criteria** (what must be TRUE):
  1. An artisan can create a piece with type, title, description, price, variants (talla/material/color/piedras with stock and price modifier), and up to 10 photos via Cloudinary — then submit it for review
  2. An admin can approve, request changes, or reject a submitted piece; the artisan receives an email notification of the result
  3. Only published pieces appear in the public catalog; visitors can filter by type, material, price range, occasion, and technique
  4. A visitor can view a product detail page with gallery, variants, and price, and an artisan profile page at /artesano/slug — both with correct SEO metadata
  5. Editing a piece or artisan profile triggers ISR revalidation so public pages reflect changes without full rebuild
**Plans**: 6 plans
**UI hint**: yes

Plans:
- [x] 02-01-PLAN.md — shadcn/ui init, deps, shared types, queries, utilities, i18n messages
- [x] 02-02-PLAN.md — Artisan piece wizard: 4-step form, variants, media upload, auto-save
- [x] 02-03-PLAN.md — Admin moderation queue with approve/changes/reject and email notifications
- [x] 02-04-PLAN.md — Public catalog listing with filters, sort, pagination
- [x] 02-05-PLAN.md — Product detail, artisan profile, gallery, variant selector, SEO
- [x] 02-06-PLAN.md — Seed migration, database push, E2E Playwright tests

### Phase 3: Commerce
**Goal**: A visitor (guest or registered) can add pieces from multiple artisans to a cart, complete a single-page checkout with per-artisan courier quote and coupon, pay via single-account Stripe (no Connect, per D-SPLIT), and receive a confirmed order with immutable snapshots and pending artisan_payout records for manual settlement
**Depends on**: Phase 2
**Requirements**: COMR-01, COMR-02, COMR-03, COMR-04, COMR-05, COMR-06, COMR-07, COMR-08, COMR-09, COUP-01, COUP-02, COUP-03
**Success Criteria** (what must be TRUE):
  1. A visitor can add pieces from multiple artisans to a persistent cart (Zustand + localStorage) and see correct totals including variant price modifiers
  2. Checkout displays a per-artisan shipping quote from Chilexpress/Starken (with 5s timeout fallback to flat rate), a no-returns disclaimer, and an international tax disclaimer with mandatory acceptance checkbox
  3. A buyer can apply a valid coupon code (single per order) and see the discount reflected before confirming payment; platform absorbs the discount per D-15
  4. Single-account Stripe payment (D-SPLIT — no Stripe Connect, no transfers.create) creates pending artisan_payout ledger rows per artisan with correct net + commission split, verified in Stripe test mode
  5. The Stripe webhook verifies signatures, enforces idempotency via event.id, atomically decrements stock with row locks, and creates the order with immutable price/title snapshots only on confirmed payment
**Plans**: 7 plans
**UI hint**: yes

Plans:
- [ ] 03-01-PLAN.md — Migrations (artisan bank fields, cart_snapshot, coupon seeds), Stripe clients, i18n checkout messages
- [ ] 03-02-PLAN.md — Multi-artisan Zustand cart with persist, sheet + /carrito page, header badge, stock-check endpoint, E2E persist
- [ ] 03-03-PLAN.md — Couriers (Chilexpress + Starken adapters, 5s timeout, flat-rate fallback) + /api/couriers/quote (TDD)
- [ ] 03-04-PLAN.md — Checkout single-page (sections + Stripe Elements + sticky summary + disclaimers checkbox) + totals/coupon/payout-ledger libs (TDD) + payment-intent endpoint
- [ ] 03-05-PLAN.md — Stripe webhook (signature, idempotency, transactional order creation, atomic stock RPC, artisan_payout ledger — single-account, no transfers) (TDD)
- [ ] 03-06-PLAN.md — /pedido/[id] page, guest HMAC magic-link token, order-confirmed React Email, sender wired into webhook
- [ ] 03-07-PLAN.md — E2E Playwright: happy path, guest, coupon, disclaimers, courier fallback, webhook idempotency

### Phase 4: Order Lifecycle
**Goal**: After payment, orders follow a strict state machine through fulfillment, with artisans managing shipments and buyers tracking status — all transitions generating email notifications
**Depends on**: Phase 3
**Requirements**: ORDR-01, ORDR-02, ORDR-03, ORDR-04, ORDR-05, ORDR-06
**Success Criteria** (what must be TRUE):
  1. An order follows the strict state sequence pending_payment -> paid -> in_preparation -> shipped -> delivered (+ cancelled), with invalid transitions rejected by the database
  2. An artisan can advance their shipment from paid to in_preparation to shipped (with courier and tracking number), and these transitions are per-artisan within a multi-artisan order
  3. A buyer can view their order history with current status and tracking information for each shipment
  4. Every state change sends a transactional email to the buyer (and relevant emails to the artisan for new orders) via Resend
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Dashboards & Operations
**Goal**: Artisans have a self-service panel for managing their business, and admins have a complete operations panel for platform governance, configuration, and reporting
**Depends on**: Phase 4
**Requirements**: ARTP-01, ARTP-02, ARTP-03, ARTP-04, ARTP-05, ADMN-01, ADMN-02, ADMN-03, ADMN-04, ADMN-05, ADMN-06, CATL-10
**Success Criteria** (what must be TRUE):
  1. An artisan can view and manage their pieces, see their order list with statuses, view their net balance and commission breakdown, and edit their public profile — all from /artesano
  2. An artisan can see notifications of piece approval/rejection and new orders within their panel
  3. An admin can manage the approval queue, activate/deactivate artisans, and manage catalog categories/tags from /admin (CATL-10)
  4. An admin can configure commission percentage and free-shipping threshold (versioned), create/edit/disable discount coupons, and view basic reports (total sales, accumulated commissions, orders by status)
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Auth | 0/4 | Planned | - |
| 2. Catalog & Discovery | 0/6 | Planned | - |
| 3. Commerce | 0/7 | Planned | - |
| 4. Order Lifecycle | 0/2 | Not started | - |
| 5. Dashboards & Operations | 0/3 | Not started | - |
