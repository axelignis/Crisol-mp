# Pitfalls Research

**Domain:** Multi-vendor artisanal jewelry marketplace (LATAM/Chile)
**Researched:** 2026-04-12
**Confidence:** HIGH (most pitfalls verified via official docs + multiple sources)

## Critical Pitfalls

### Pitfall 1: CLP Is a Zero-Decimal Currency in Stripe

**What goes wrong:**
CLP (Chilean Peso) is a zero-decimal currency in Stripe. If you treat it like USD (multiply by 100 to get cents), you charge 100x the intended amount. A CLP $50,000 necklace becomes CLP $5,000,000. Conversely, if you divide by 100 on display, prices appear 100x too low. This also affects `application_fee_amount` in split payments -- a miscalculated commission silently over/under-charges artisans.

**Why it happens:**
Most Stripe tutorials use USD (a two-decimal currency). Developers copy patterns like `amount: price * 100` without checking the currency type. CLP has no subunit -- 1 CLP = 1 CLP, not 100 centavos.

**How to avoid:**
- Build a currency utility that maps currencies to their decimal factor. CLP factor = 1, USD factor = 100.
- Use this utility in every Stripe amount calculation: `commission.ts`, checkout, refunds, webhook amount verification.
- Add a Zod schema that validates CLP amounts are integers with no decimal points.
- Write unit tests: `toCents('CLP', 50000) === 50000` and `toCents('USD', 50.00) === 5000`.

**Warning signs:**
- Stripe test charges in CLP showing absurdly high amounts in the Dashboard.
- `application_fee_amount` larger than the charge amount (Stripe rejects this).
- Price discrepancies between catalog display and Stripe charge confirmation emails.

**Phase to address:**
Phase 1 (Foundations) -- bake into `lib/utils/currency.ts` and `lib/utils/commission.ts` from day one. Every downstream payment feature depends on this being correct.

---

### Pitfall 2: RLS Policies That Silently Return Empty Results

**What goes wrong:**
You enable RLS on all 22 tables (as required), but forget to create policies for some tables or some operations. Queries return zero rows with no error. The app appears broken -- empty catalog, missing orders, blank artisan dashboards -- but there are no error messages because empty results are valid Postgres responses.

**Why it happens:**
RLS has two failure modes that look identical from the app side: (1) no matching rows, and (2) no policy grants access. The SQL Editor runs as `postgres` superuser which bypasses RLS, so development queries work fine. Problems only surface when the app uses `anon` or `authenticated` roles.

**How to avoid:**
- Create a migration checklist: every `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` must be followed by at least one SELECT, INSERT, UPDATE, DELETE policy per role that needs access.
- Write an integration test per table that authenticates as each role and verifies expected CRUD access.
- Use Supabase's Database Advisor (lint `0003_auth_rls_initplan`) to catch missing policies.
- Never test RLS logic solely in the SQL Editor -- always test through the Supabase client SDK with real JWTs.

**Warning signs:**
- Pages that work in development but show "No results" in staging.
- Artisan dashboard showing zero pieces despite database having data.
- Admin queries that work in SQL Editor but fail through the API.

**Phase to address:**
Phase 1 (Migrations/Auth) -- write RLS policies and integration tests simultaneously with each migration.

---

### Pitfall 3: RLS Performance Death Spiral on `auth.uid()` Calls

**What goes wrong:**
Every RLS policy calling `auth.uid()` directly invokes the function per-row. On a catalog table with 10,000 products and 5 policies each calling `auth.uid()`, that is 50,000 function calls per query. At 100,000 rows, queries timeout. The catalog becomes unusable.

**Why it happens:**
The naive policy `USING (user_id = auth.uid())` looks correct and works fine with small datasets. Postgres does not automatically cache the result of `auth.uid()` across rows -- it re-evaluates per row because it cannot prove the function is immutable in this context.

**How to avoid:**
- Always wrap in a subselect: `USING (user_id = (SELECT auth.uid()))`. The `SELECT` wrapper causes Postgres to create an InitPlan that caches the value for the entire statement.
- Apply the same pattern to `auth.jwt()` and any custom function used in policies.
- Create indexes on every column referenced in RLS policies (`user_id`, `artisan_id`, `role`, `status`).
- For role-based checks across multiple tables, create a `SECURITY DEFINER` function like `has_role('artisan')` that encapsulates the lookup and benefits from caching.
- Run `EXPLAIN ANALYZE` on critical queries with RLS active to verify index scans, not sequential scans.

**Warning signs:**
- Catalog page load times increasing as products are added.
- Supabase Dashboard showing high query latencies on `SELECT` operations.
- `EXPLAIN ANALYZE` showing Seq Scan on tables with RLS policies.

**Phase to address:**
Phase 1 (Migrations) -- establish the `(SELECT auth.uid())` pattern from the first migration. Retrofitting 22 tables of policies is painful.

---

### Pitfall 4: Stripe Webhook Double-Processing Corrupts Order State

**What goes wrong:**
Stripe sends `payment_intent.succeeded` twice (network retry, timeout, infrastructure issue). The first event transitions the order from `pending_payment` to `paid` and triggers the split payment transfer. The second event tries to do the same -- potentially creating a duplicate transfer to the artisan, sending duplicate confirmation emails, or corrupting the order state machine.

**Why it happens:**
Stripe uses at-least-once delivery. Your webhook endpoint might process the event successfully but return a non-2xx due to an unrelated error (logging failure, email timeout), causing Stripe to retry. Stripe retries for up to 3 days.

**How to avoid:**
- Store `event.id` in a `webhook_events` table with a UNIQUE constraint. Before processing, INSERT the event ID -- if it violates uniqueness, skip.
- Use a database transaction: check idempotency, update order state, create transfer record -- all atomically.
- Return 200 immediately after validating the signature and enqueuing work. Do not do heavy processing (email, transfer API calls) synchronously in the webhook handler.
- Verify the webhook signature using `stripe.webhooks.constructEvent()` with the raw body -- never parse the body before verification.

**Warning signs:**
- Duplicate entries in the `webhook_events` or `payment` tables.
- Artisans receiving double payouts.
- Order status logs showing repeated transitions (paid -> paid).
- Stripe Dashboard showing webhook delivery retries.

**Phase to address:**
Phase 2 (Payments/Checkout) -- implement idempotency from the first webhook handler. Cannot be bolted on later without risking data corruption.

---

### Pitfall 5: Order/Product State Machine Allows Invalid Transitions

**What goes wrong:**
Without enforced state transitions, an order can jump from `pending_payment` directly to `shipped` (skipping `paid` and `in_preparation`), or a product can go from `draft` to `published` (skipping `pending_review`). This breaks business invariants: unpaid orders get shipped, unreviewed products appear in the catalog.

**Why it happens:**
State machines are implemented as simple string columns with no constraint on valid transitions. Any UPDATE can set any status value. Concurrent requests (artisan clicks "ship" while admin clicks "cancel") create race conditions where the last write wins.

**How to avoid:**
- Enforce valid transitions in a Postgres function: `transition_order_status(order_id, new_status)` that checks `current_status -> new_status` against an allowed transitions map. Reject invalid transitions with a raised exception.
- Use `SELECT ... FOR UPDATE` inside the transition function to lock the row during the state check, preventing race conditions.
- Add a CHECK constraint or ENUM type for the status column so only valid status values can exist.
- Log every transition in an `order_status_history` / `product_status_history` audit table with timestamp, actor, old_status, new_status.
- Never expose raw UPDATE on the status column through the API -- only expose the transition function.

**Warning signs:**
- Orders in `shipped` status with no `paid` timestamp.
- Products visible in the catalog that were never reviewed.
- Audit logs showing impossible state sequences.

**Phase to address:**
Phase 1 (Migrations) -- define transition functions and constraints in the initial schema. The state machines are referenced by every downstream feature.

---

### Pitfall 6: Supabase Auth Session Cached by CDN Serves Wrong User

**What goes wrong:**
When Supabase SSR refreshes a session token server-side, it sets a `Set-Cookie` header in the response. If a CDN (Vercel Edge, Cloudflare) caches that response, a different user receives the cached page with the first user's auth token. That user is now signed in as someone else -- seeing their orders, their artisan dashboard, their payment information.

**Why it happens:**
ISR pages that check auth in server components generate responses with `Set-Cookie` headers. CDNs cache the full response including headers. Vercel's default caching behavior can conflict with auth token refresh.

**How to avoid:**
- Use `export const dynamic = 'force-dynamic'` on every page that reads auth state (checkout, account, artisan panel, admin panel).
- Ensure the Supabase middleware correctly passes `Cache-Control: no-store` headers when tokens are refreshed (handled by `@supabase/ssr` v0.10.0+, but verify).
- Never mix ISR/SSG with authenticated content on the same page. The catalog (ISR) should be public-only; user-specific content (cart count in header) should load client-side.
- Restrict the middleware matcher to avoid running on static assets and API routes that do not need session refresh.

**Warning signs:**
- Users reporting they see someone else's account data.
- Auth tokens in browser DevTools that do not match the logged-in user.
- Middleware running 9+ times per page load (Next.js prefetching all links triggers middleware).

**Phase to address:**
Phase 1 (Auth/Middleware) -- get the middleware matcher and caching headers right before building any authenticated pages.

---

### Pitfall 7: Split Payment Commission Rounding Errors Accumulate

**What goes wrong:**
With CLP as a zero-decimal currency, a 12% commission on a CLP $8,333 item is CLP $999.96 -- but CLP has no fractions. Do you round to 999 or 1000? Over hundreds of transactions, these rounding errors accumulate. The platform's accounting does not reconcile: sum of (artisan_net + commission) != sum of charges. Stripe rejects transfers where `application_fee_amount + transfer_amount != charge_amount`.

**Why it happens:**
Developers use floating-point arithmetic for percentage calculations. JavaScript's `0.1 + 0.2 !== 0.3` problem. With zero-decimal currencies, every calculation must produce integers, and the rounding strategy must ensure the parts always sum to the whole.

**How to avoid:**
- In `commission.ts`, always calculate commission first, then derive artisan_net as `total - commission` (not independently). This guarantees `commission + artisan_net === total`.
- Use integer arithmetic only. Calculate commission as `Math.round(total * rate)` or `Math.floor(total * rate)` -- pick one strategy and document it.
- Store the commission rate as basis points (1200 = 12%) to avoid floating-point division.
- Add an assertion in every payment flow: `if (commission + artisanNet !== total) throw new Error('Split mismatch')`.
- Write unit tests with edge-case amounts (1 CLP, 3 CLP at 12%, amounts that create repeating decimals).

**Warning signs:**
- Stripe API errors: "application_fee_amount exceeds charge amount."
- Accounting reports where total revenue != sum of commissions + sum of artisan payouts.
- Artisan balance discrepancies accumulating over time.

**Phase to address:**
Phase 1 (Foundations) -- `commission.ts` is a foundational utility. Every payment and reporting feature depends on it being mathematically sound.

---

### Pitfall 8: Views Bypass RLS by Default

**What goes wrong:**
You create a Postgres view (e.g., `catalog_view` joining products + artisans + media for the public catalog) and assume RLS protects it. By default, views execute with the permissions of the view creator (`postgres` superuser), bypassing all RLS on underlying tables. The view exposes draft products, rejected pieces, and private artisan data to `anon` users through the Supabase API.

**Why it happens:**
Postgres creates views with `SECURITY DEFINER` by default -- the view runs as its owner, not as the calling user. This is a Postgres feature, not a bug, but it violates the mental model of "RLS protects everything."

**How to avoid:**
- On Postgres 15+ (Supabase uses this): add `WITH (security_invoker = true)` to every view definition. This makes the view respect RLS of the underlying tables.
- Alternatively, avoid views for API-exposed data and use server-side functions with `SECURITY INVOKER`.
- If views must be used, add explicit RLS policies on the view itself.
- Audit all views in the schema during security review.

**Warning signs:**
- Public API returning data that should be restricted (draft products visible, other users' orders accessible).
- Security audit tools flagging views without `security_invoker`.

**Phase to address:**
Phase 1 (Migrations) -- establish the `security_invoker = true` convention from the first view creation.

---

### Pitfall 9: Multi-Courier Integration Fails Silently at Checkout

**What goes wrong:**
Checkout calls 4 courier APIs (Chilexpress, Starken, DHL, FedEx) for shipping quotes. One API is down or slow (5+ second timeout). The checkout page either hangs waiting for all responses, shows an error that blocks the entire purchase, or worse -- silently drops that courier option and the buyer sees incomplete/wrong shipping prices.

**Why it happens:**
Courier APIs (especially Chilexpress and Starken) have inconsistent uptime and response times. Developers call them sequentially or with a single `Promise.all` that rejects on any failure. No fallback pricing exists.

**How to avoid:**
- Use `Promise.allSettled()` for parallel courier requests. Show available quotes from successful responses; mark failed couriers as "temporarily unavailable."
- Set aggressive timeouts (3 seconds) per courier. A slow courier should not block checkout.
- Cache recent quotes for the same origin/destination/weight for 15-30 minutes. Courier rates do not change minute-to-minute.
- Implement a fallback flat-rate table for each courier that activates when the API is unreachable. Flag these as "estimated" to the buyer.
- Log every courier API failure for monitoring. Alert if a courier has >10% failure rate.

**Warning signs:**
- Checkout page load times >5 seconds.
- Buyers abandoning cart at the shipping step.
- Error logs showing courier API timeouts clustering at specific times.

**Phase to address:**
Phase 2 (Shipping Integration) -- build the resilient courier abstraction layer before wiring up checkout. The `lib/couriers/index.ts` interface must handle failures gracefully from the start.

---

### Pitfall 10: ISR Revalidation Only Updates One Server Instance

**What goes wrong:**
After an admin approves a product (triggering `revalidatePath('/es/catalogo')`), the revalidation only clears the cache on the server instance that handled the request. Other instances (in multi-replica deployments on Vercel or self-hosted) continue serving the stale catalog. Content editors see their changes (routed to the same instance) but buyers on other instances see old data for hours.

**Why it happens:**
`revalidatePath()` and `revalidateTag()` are local operations by default. In Vercel's serverless architecture, each function invocation may run on a different instance. The ISR cache is not shared across instances without explicit configuration.

**How to avoid:**
- On Vercel: use `revalidateTag()` instead of `revalidatePath()` -- Vercel's infrastructure propagates tag-based invalidation across its CDN edge.
- Tag catalog pages with `unstable_cache` tags like `product-${id}`, `catalog`, `artisan-${id}`.
- For the revalidation API route (`/api/revalidate`), use tag-based invalidation and verify with the `REVALIDATE_SECRET`.
- After revalidation, verify the content is fresh by fetching the page and checking the response. If stale, trigger a second revalidation.
- If self-hosting: use a shared cache store (Redis) via OpenNext or similar.

**Warning signs:**
- Approved products not appearing in the catalog for some users.
- Inconsistent catalog content across page refreshes (load balancer routing to different instances).
- Content editors confirming changes are live, but buyers reporting stale content.

**Phase to address:**
Phase 2 (Catalog/ISR) -- implement tag-based revalidation from the first ISR page. Switching from path-based to tag-based later requires refactoring every revalidation call.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded commission % | Faster initial dev | Cannot change without deploy; breaks admin panel promise | Never -- `COMMISSION_CONFIG` table exists for this reason |
| Skip webhook idempotency | Simpler webhook handler | Double payouts, corrupted order states | Never |
| RLS policies without `(SELECT auth.uid())` wrapper | Simpler SQL, works in dev | Performance cliff at ~1000 rows | Never -- trivial to do correctly from the start |
| Unsigned Cloudinary uploads | No server round-trip | Anyone with cloud_name + preset can upload to your account | Never -- project already mandates signed uploads |
| Testing RLS only in SQL Editor | Faster iteration | False confidence; policies untested with real roles | Only during initial policy drafting, must verify with client SDK before merge |
| Sequential courier API calls | Simpler code | Checkout blocked by slowest courier (5-15s) | Never -- parallel with timeout from day one |
| Storing USD prices alongside CLP | Simpler display logic | Stale exchange rates persisted in DB; inconsistent pricing | Never -- project spec says USD is display-only via `/api/currency` |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stripe Connect (Chile) | Using Express accounts without verifying Chile availability | Confirm Express account support for CL before building onboarding. Have Custom account fallback ready |
| Stripe Webhooks | Parsing request body before signature verification | Use raw body (`request.text()`) for `constructEvent()`, then parse after verification |
| Stripe CLP | Multiplying amount by 100 (two-decimal pattern) | CLP is zero-decimal: pass the integer amount directly (50000 = CLP $50,000) |
| Supabase Auth | Using `getSession()` in server code to validate users | Always use `getUser()` -- it revalidates the token with Supabase Auth server. `getSession()` trusts the JWT without verification |
| Supabase Storage | Creating public buckets for product images | Keep buckets private. Use signed URLs for serving or make bucket public only for read (upload/delete still require RLS) |
| Cloudinary | Exposing API secret in client-side upload code | Use server-signed uploads via `/api/upload` route. Client sends to Cloudinary with the signature, never sees the API secret |
| Chilexpress/Starken APIs | Trusting API response times in production | Wrap with 3-second timeout, cache quotes, have flat-rate fallback |
| Resend | Sending transactional emails synchronously in webhook handlers | Return 200 first, enqueue email sending. Webhook timeouts cause Stripe retries |
| next-intl | Forgetting `[locale]` segment in dynamic routes | Every public route must be under `[locale]/`. Missing it causes 404s for the non-default locale |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 queries in catalog (fetch products, then media per product) | Catalog page >2s load time | Join products + media in a single query or use Supabase's `select('*, media(*)')` | >50 products |
| Unindexed RLS policy columns | Increasing query latency as data grows | Index every column in RLS policies | >1,000 rows per table |
| Loading all catalog images eagerly | LCP >2.5s, failed Lighthouse CI | Lazy load below-fold images, use Cloudinary auto-format (WebP/AVIF) | >20 products on page |
| ISR revalidation on every product edit (not publish) | Excessive revalidation, Vercel function invocations spike | Only revalidate on status transitions to/from `published` | >10 products edited per day |
| Full product data in cart Zustand store | LocalStorage quota exceeded, slow hydration | Store only `{product_id, variant_id, quantity}` in cart; fetch details on render | Cart with >10 items or products with large media arrays |
| Middleware running on every prefetch | Auth token refresh 9x per page navigation | Restrict middleware matcher to exclude `/_next/`, static files, and API routes that don't need auth | Any page with >3 internal links |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing `service_role` key to client | Full database access bypassing all RLS | Only use in server-side code (`lib/supabase/server.ts`). Verify no `NEXT_PUBLIC_` prefix on service role env var |
| RLS policy using `user_metadata` from JWT | Users can modify their own `user_metadata` via Supabase Auth API, potentially escalating roles | Use `app_metadata` (only settable server-side) or a dedicated `user_roles` table for role checks |
| INSERT policy without `WITH CHECK` | Users can insert rows with arbitrary `user_id`, impersonating other users | Every INSERT/UPDATE policy must include `WITH CHECK` matching the authenticated user |
| Webhook endpoint without signature verification | Attackers can forge payment confirmations, mark orders as paid | Always verify Stripe signature with `constructEvent()` using the webhook secret |
| Commission calculation on client side | Buyers or artisans could manipulate the displayed commission/price | Calculate all payment amounts server-side only. Client displays are informational |
| Public Cloudinary upload preset | Anyone can upload arbitrary files to your Cloudinary account | Use signed uploads only. Validate file type, size, and dimensions server-side before generating signature |
| Missing rate limiting on `/api/upload` | Abuse: mass file uploads consuming Cloudinary quota | Rate limit by authenticated user (e.g., 20 uploads/minute) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No shipping estimate before checkout | Buyers abandon when surprise shipping cost appears | Show estimated shipping on product page or cart based on buyer's region |
| "No returns" policy buried in T&C | Disputes, chargebacks, trust erosion | Display no-returns notice prominently on product page AND checkout summary |
| Artisan onboarding requires Stripe immediately | Artisans drop off before listing first product | Allow artisans to create profiles and draft products before Stripe onboarding. Require Stripe only before publishing |
| Unique/one-of-a-kind items sold to multiple buyers | Race condition: two buyers checkout the same unique piece | Use database-level stock reservation (decrement on checkout start, release on timeout/cancel) with `SELECT FOR UPDATE` |
| Currency display confusion (CLP vs USD) | International buyers confused by prices | Always show canonical CLP price prominently. USD is secondary, marked as "approximate" with disclaimer |
| Product approval queue with no feedback | Artisans submit pieces, hear nothing for days | Send email on submission, on review start, and on decision. Show estimated review time in artisan dashboard |
| 3D model viewer loading blocks page | Main product page unusable until heavy 3D asset loads | Lazy-load model-viewer component. Show product photos immediately. 3D viewer loads on explicit user interaction |

## "Looks Done But Isn't" Checklist

- [ ] **RLS:** Enabled on all 22 tables -- verify no table was missed by querying `pg_tables` where `rowsecurity = false`
- [ ] **RLS policies:** Every table has policies for every role that needs access -- verify with integration tests per role
- [ ] **Webhook idempotency:** `webhook_events` table exists with UNIQUE on `event_id` -- verify by sending the same event twice
- [ ] **State machine:** Transition functions reject invalid state changes -- verify with test: `pending_payment -> shipped` should fail
- [ ] **Commission math:** `commission + artisan_net === total` for ALL amounts -- verify with property-based test across random CLP values
- [ ] **CLP amounts:** No multiplication by 100 in any Stripe API call when currency is CLP -- grep for `* 100` near Stripe calls
- [ ] **Auth guard:** `/artesano/*` rejects non-artisan users, `/admin/*` rejects non-admin -- verify by accessing with wrong role
- [ ] **ISR + Auth separation:** No `Set-Cookie` headers on ISR-cached pages -- verify by inspecting response headers on catalog pages
- [ ] **Cloudinary:** All uploads go through `/api/upload` with signed preset -- verify no unsigned preset exists in Cloudinary dashboard
- [ ] **Email sending:** Not blocking webhook response -- verify webhook returns 200 in <1 second under load
- [ ] **Courier fallback:** Checkout still works when one courier API is down -- verify by blocking a courier host in test
- [ ] **Middleware matcher:** Excludes `/_next/static`, `/_next/image`, `/favicon.ico` -- verify middleware does not run on asset requests

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| CLP zero-decimal miscalculation | HIGH | Audit all charges in Stripe Dashboard. Issue refunds for overcharges. Patch `currency.ts`. Re-run commission calculations for affected orders |
| Double webhook processing | HIGH | Audit `payment` and `transfer` tables for duplicates. Reverse duplicate transfers via Stripe API. Add idempotency table. Replay missed events |
| RLS policies missing | MEDIUM | Query `pg_policies` to find gaps. Write missing policies. Re-test all API endpoints per role. Audit access logs for unauthorized data access |
| State machine violation | MEDIUM | Query for orders/products in impossible states. Manually correct states with admin override. Add transition constraints. Backfill audit log |
| Commission rounding drift | LOW | Run reconciliation query: sum of commissions + artisan nets vs. sum of charges. Adjust last transaction to absorb difference. Fix rounding in `commission.ts` |
| ISR serving stale content | LOW | Trigger manual revalidation of affected paths. If persistent, redeploy to clear all ISR caches |
| Courier API outage at checkout | LOW | Enable flat-rate fallback immediately. Monitor courier API recovery. Notify affected buyers if shipping quotes change |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| CLP zero-decimal currency | Phase 1 (Foundations) | Unit tests on `currency.ts`: `toCents('CLP', 50000) === 50000` |
| RLS empty results | Phase 1 (Migrations) | Integration test per table per role returning expected row counts |
| RLS `auth.uid()` performance | Phase 1 (Migrations) | `EXPLAIN ANALYZE` on catalog query showing Index Scan, not Seq Scan |
| Webhook double-processing | Phase 2 (Payments) | Send same `event.id` twice; second is no-op; no duplicate DB entries |
| State machine violations | Phase 1 (Migrations) | Transition function rejects `pending_payment -> shipped` with error |
| CDN caching auth tokens | Phase 1 (Auth/Middleware) | ISR pages have no `Set-Cookie`; auth pages have `Cache-Control: no-store` |
| Commission rounding errors | Phase 1 (Foundations) | Property test: for all CLP amounts and rates, `commission + net === total` |
| Views bypass RLS | Phase 1 (Migrations) | All views have `security_invoker = true`; test with `anon` role |
| Courier API failures | Phase 2 (Shipping) | Checkout returns shipping options when one courier is unreachable |
| ISR multi-instance staleness | Phase 2 (Catalog) | After revalidation, 3 consecutive fetches return fresh content |

## Sources

- [Stripe: Supported currencies (zero-decimal list)](https://docs.stripe.com/currencies)
- [Stripe: Receive events in webhook endpoint (retries, idempotency)](https://docs.stripe.com/webhooks)
- [Stripe: Connect account types](https://docs.stripe.com/connect/accounts)
- [Stripe: Separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers)
- [Supabase: Row Level Security docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase: Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase: Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase: Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Next.js: ISR Guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)
- [Next.js: How Revalidation Works](https://nextjs.org/docs/app/guides/how-revalidation-works)
- [Next.js ISR stale data issue #58909](https://github.com/vercel/next.js/issues/58909)
- [Cloudinary: Upload security considerations](https://support.cloudinary.com/hc/en-us/articles/360018796451)
- [Cloudinary: Signed uploads with Next.js](https://cloudinary.com/blog/guest_post/signed-uploads-in-cloudinary-with-next-js)
- [Hookdeck: Implementing webhook idempotency](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency)

---
*Pitfalls research for: Crisol -- multi-vendor artisanal jewelry marketplace*
*Researched: 2026-04-12*
