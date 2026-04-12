# Codebase Concerns

**Analysis Date:** 2026-04-12

## Critical: Incomplete Implementation

**API Route Stubs:**
- Issue: All webhook and API routes are empty stubs returning `{ ok: true }`
- Files: 
  - `src/app/api/webhooks/stripe/route.ts`
  - `src/app/api/webhooks/coinbase/route.ts`
  - `src/app/api/upload/route.ts`
  - `src/app/api/revalidate/route.ts`
  - `src/app/api/currency/route.ts`
  - `src/app/api/couriers/quote/route.ts`
  - `src/app/api/og/route.ts`
  - `src/app/[locale]/auth/callback/route.ts`
- Impact: Payment processing, file uploads, currency conversion, courier quotes, auth callbacks, and revalidation will not function. Critical business operations blocked.
- Fix approach: Implement each route according to API specification in `docs/api_spec.html`. Prioritize webhook routes first (payment integrity depends on it).

**Commission Utility Stub:**
- Issue: `src/lib/utils/commission.ts` is empty
- Impact: Cannot calculate split payments between platform and artisans. All financial logic broken.
- Fix approach: Implement `calculateSplit()`, `applyDiscount()`, `redeemPoints()` functions per testing strategy in `docs/testing_strategy.md`.

**Stripe & Cloudinary Client Stubs:**
- Issue: `src/lib/stripe/split.ts` and `src/lib/stripe/client.ts` are empty
- Impact: Cannot process payments or handle split payment transfers to artisan Connect accounts
- Fix approach: Implement Stripe API client using `stripe` package. Add split payment orchestration.

**Courier Integration Stubs:**
- Issue: All courier modules (Chilexpress, Starken, DHL, FedEx) in `src/lib/couriers/` are empty
- Impact: Shipping quote and tracking integration non-functional
- Fix approach: Implement integrations according to each courier API. Create unified interface in `src/lib/couriers/index.ts`.

## Test Coverage Gap

**No Test Files:**
- Issue: No test files exist anywhere in the project
- Files: Missing:
  - `src/test/` directory (factories, setup, utilities)
  - `tests/e2e/` directory (Playwright E2E tests)
  - Unit test files (`.test.ts` / `.spec.ts`)
- Impact: No way to verify business logic. Critical financial flows untested. Regressions undetected.
- Priority: HIGH - Required before any feature reaches production
- Fix approach: Create test infrastructure per CLAUDE.md rule: "Todo feature nuevo requiere tests E2E en Playwright antes de cerrar la rama". Start with commission logic (100% coverage required per testing_strategy.md), then webhook handlers (80% coverage), then components (60% coverage).

**Missing Test Configuration:**
- Issue: No `vitest.config.ts` or `playwright.config.ts` files
- Impact: Cannot run tests even after they're written
- Fix approach: Create config files per templates in `docs/testing_strategy.md` (lines 376-428).

## Security & Validation

**Webhook Signature Verification Missing:**
- Issue: Stripe and Coinbase webhook handlers are stubs. No signature verification implemented.
- Risk: Attacker can forge webhook events (payment_intent.succeeded, charge.failed) to manipulate orders and bypass payment
- Fix approach: Implement webhook signature verification:
  - Stripe: Use `stripe.webhooks.constructEvent(body, signature, webhookSecret)` in `src/app/api/webhooks/stripe/route.ts`
  - Coinbase: Verify `X-CC-Webhook-Signature` header in `src/app/api/webhooks/coinbase/route.ts`
  - Store signatures in environment variables (never hardcode)

**Webhook Idempotency Not Implemented:**
- Issue: Webhook handlers don't deduplicate events by `event.id`
- Risk: Duplicate webhook delivery creates duplicate payments, wrong order totals, corrupted data
- Fix approach: Before processing webhook, check if `stripe_event_id` (or equivalent) exists in database. Only process if first occurrence.

**No Input Validation on API Routes:**
- Issue: API routes are stubs, but pattern should include Zod validation per CLAUDE.md rule
- Risk: Malformed requests could cause 500 errors or SQL injection if not validated
- Fix approach: All API routes must validate request body with Zod schema before processing

**Environment Variables Security:**
- Issue: `.env.example` not found; unclear which secrets are required
- Risk: Developers might expose secrets in code or misconfigure env vars
- Fix approach: Create `.env.example` listing all required vars and their purposes
- Critical vars to never expose client-side:
  - `SUPABASE_SERVICE_ROLE_KEY` (admin-level database access)
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `COINBASE_WEBHOOK_SECRET`
  - Courier API keys (Chilexpress, Starken, DHL, FedEx)
  - `CLOUDINARY_API_SECRET`
  - `RESEND_API_KEY`

**Auth Callback Missing Implementation:**
- Issue: `src/app/[locale]/auth/callback/route.ts` is a stub
- Risk: OAuth callback from Supabase Auth fails, users cannot sign up/login
- Fix approach: Implement per Supabase SSR auth flow:
  1. Exchange auth code for session
  2. Set cookies for authenticated requests
  3. Redirect to dashboard or login page based on auth success

**Cloudinary Upload Validation:**
- Issue: `src/app/api/upload/route.ts` is a stub (should validate and sign uploads)
- Risk: Users could upload malicious files, files without size limit, wrong formats
- Fix approach: Per CLAUDE.md: "Uploads de media solo vía firma Cloudinary desde `/api/upload`"
  - Validate `MAX_PHOTOS_PER_PRODUCT` (10) limit per product
  - Validate file type (image/video only)
  - Sign upload with Cloudinary credentials
  - Return signed URL for client-side upload

**On-Demand Revalidation Endpoint Unprotected:**
- Issue: `src/app/api/revalidate/route.ts` is a stub
- Risk: Anyone can trigger revalidation (DoS) if REVALIDATE_SECRET not verified
- Fix approach: Check `REVALIDATE_SECRET` header matches environment variable before revalidating ISR paths

## RLS Completeness

**RLS Enabled Broadly (Good):**
- All tables have RLS enabled per `supabase/migrations/008_triggers_rls.sql` (lines 218-242)
- Policies use helper functions (`current_user_role()`, `current_artisan_id()`, `current_buyer_id()`)

**Policy Coverage Gaps (Potential Issues):**
- Issue: `order` table allows "cualquiera puede crear pedido" (line 399-400) - anonymous users can create orders
- Risk: If no validation on order creation, fake orders could spike counts, affect analytics
- Fix approach: Validate order.buyer_id matches auth.uid() on INSERT (not just allow true)

- Issue: `order_item` and `shipping_address` policies allow anonymous INSERT (lines 421-422, 477-479)
- Risk: Orphaned records if corresponding order doesn't exist
- Fix approach: Add foreign key constraint checks via CHECK or WITH CHECK in policies

**Admin Panel Not Auth-Protected at Edge:**
- Issue: `src/app/admin/layout.tsx` (line 18) redirects to home if not admin
- Risk: This is CSR-safe but blocks are at component level, not route level
- Impact: Layout must load and check, increasing latency. Middleware-level auth guard better.
- Fix approach: Consider moving auth checks to `middleware.ts` for `/admin/*` and `/artesano/*` routes to fail faster

## Data Integrity

**Empty Commission Configuration:**
- Issue: `src/lib/utils/commission.ts` is stub; no default commission percentage stored
- Risk: If not set via admin panel, all split payments fail
- Fix approach: Populate default commission % in `commission_config` table during seed. Validate before any payment.

**Product Status Transitions Not Validated:**
- Issue: Product state machine (draft → pending_review → published) implemented in DB triggers but no validation in API
- Risk: If API routes implemented without checking valid transitions, product status could be corrupted (published → draft, etc.)
- Fix approach: Validate status transitions in API before updating product.status. Only allow documented transitions.

**Order Status Machine Not Validated:**
- Issue: Order states (pending_payment → paid → in_preparation → shipped → delivered) have triggers for updated_at but no transition guard
- Risk: Status could jump (pending_payment → shipped, skipping in_preparation)
- Fix approach: Add CHECK constraint on order.status or validate in API routes

## Missing Critical Features

**Stripe Connect Account Linking:**
- Issue: No implementation for artisan Connect account setup
- Blocks: Split payment feature; artisans cannot receive payments
- Fix approach: Implement OAuth flow to link artisan Stripe Connect accounts before first sale

**Loyalty Points System Incomplete:**
- Issue: Schema exists (`loyalty_transaction`, `membership_level`, `buyer.total_points`) but no API to earn/spend points
- Blocks: Loyalty feature cannot function
- Fix approach: Implement point accrual on order.paid, redemption in checkout

**Notifications System Stub:**
- Issue: `notification` table exists but no API to send notifications
- Risk: Users never notified of order status changes, new followers, piece approvals
- Fix approach: Implement push notification service (Resend email) triggered by webhooks and state changes

## Database Consistency

**Triggers for Stock Management Exist:**
- Good: `fn_check_product_sold()` marks product as 'sold' when stock reaches 0 (lines 174-190)
- Note: Only for unique pieces (`is_unique = true`). Verify variant stock decrements on order creation.

**Membership Level Auto-Upgrade Implemented:**
- Good: `fn_check_membership_upgrade()` automatically upgrades buyer tier based on points (lines 146-169)
- Risk: Trigger fires BEFORE UPDATE on `total_points`. If multiple transactions happen fast, could miss upgrade.
- Fix approach: Add idempotency check or use scheduled job for membership recalculation.

## Performance & Scaling

**No Indexes on High-Query Tables:**
- Issue: Migrations include `007_indexes.sql` but file not examined. Assuming baseline indexes exist.
- Risk: Heavy queries without proper indexing (product filters by category/tag, orders by buyer, search) will slow under load
- Fix approach: Verify `007_indexes.sql` covers:
  - `product(artisan_id, status)` for artisan product lists
  - `order(buyer_id, status)` for buyer order lists
  - `order_item(order_id, artisan_id)` for artisan incoming orders
  - Search indexes if full-text search used

**No Rate Limiting on API Routes:**
- Issue: Couriers, upload, currency endpoints are stubs but will have no rate limiting when implemented
- Risk: Abuse of quote/upload endpoints, price spam
- Fix approach: Add rate limiting middleware on sensitive endpoints (upload = 10/min per user, quote = 100/day per IP)

## Fragile Areas

**Product Variant Stock Management:**
- Files: `supabase/migrations/004_catalog.sql` (schema) + missing API routes
- Why fragile: Stock decrements on order_item creation. If transaction fails mid-way, stock gets decremented but payment never charged.
- Safe modification: Wrap order + payment + inventory in database transaction. Verify idempotency.

**RLS Policies on Product Visibility:**
- Files: `supabase/migrations/008_triggers_rls.sql` (lines 292-310)
- Why fragile: Artisans see all their products (draft/pending/published). Buyers see only published/sold. Anon see only published.
  Query by status is critical. If status column ever renamed or type changed, RLS breaks silently.
- Safe modification: Add tests to verify RLS policies work (mentioned in testing_strategy.md lines 185-215)

**Webhook Event Deduplication:**
- Files: `src/app/api/webhooks/stripe/route.ts`, `src/app/api/webhooks/coinbase/route.ts` (not implemented)
- Why fragile: If idempotency not implemented, duplicate webhook delivery = duplicate payments. Hard to debug later.
- Safe modification: Implement event_id check FIRST, before any business logic. Add test case for duplicate events.

## Dependencies at Risk

**Supabase Realtime Not Configured:**
- Issue: No Realtime subscription for live order updates, notifications
- Impact: Admin/artisan dashboards must poll for order changes; no real-time notifications
- Risk: Users see stale data; UX degraded
- Migration path: Enable Realtime in `supabase/config.toml`. Add `useChannel()` hook for live updates.

**Cloudinary Transformation Pipeline Missing:**
- Issue: `src/lib/cloudinary/upload.ts` is stub
- Impact: Cannot auto-resize images, create thumbnails, serve optimal formats
- Risk: Large images slow down catalog; mobile experience poor
- Migration path: Use Cloudinary transformations (e.g., `/c_scale,w_400/image.jpg`) in product gallery

**Stripe Version Pinned to 17.1.0:**
- Issue: `package.json` locks `"stripe": "^17.1.0"`
- Risk: Major version bump could break webhook handling, payment logic
- Recommendation: Monitor Stripe changelog. Test updates in CI before merging.

**Next.js 14.2.15 — No Upgrade Path Planned:**
- Issue: Early LTS version; newer releases available
- Risk: Security patches lag; missing performance improvements
- Recommendation: Plan quarterly upgrades. Test thoroughly before upgrading middleware, routing logic.

## Translation & Localization

**English Translations Missing:**
- Issue: `messages/en.json` likely empty; structure ready per docs/project_structure.md line 24
- Impact: English users see untranslated Spanish text or fallback keys
- Fix approach: Use Spanish as source. Translate critical paths first (checkout, auth, product details). Use Resend for translation automation if needed.

---

*Concerns audit: 2026-04-12. Early bootstrap stage; most concerns are incomplete implementations (stubs) rather than bugs. Priorities: implement API routes, add tests, secure webhooks.*
