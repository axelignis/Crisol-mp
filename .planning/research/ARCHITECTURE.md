# Architecture Research

**Domain:** Multi-vendor artisanal jewelry marketplace
**Researched:** 2026-04-12
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                    │
│  │ Public Store  │  │ Artisan Dash │  │  Admin Panel  │                   │
│  │ [locale]/*    │  │ artesano/*   │  │  admin/*      │                   │
│  │ SSG/ISR       │  │ SSR+CSR      │  │  SSR+CSR      │                   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                    │
│         │                 │                  │                            │
├─────────┴─────────────────┴──────────────────┴───────────────────────────┤
│                         MIDDLEWARE LAYER                                  │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │  Session Refresh (Supabase) + Locale Routing (next-intl)        │     │
│  │  + Role-based Layout Guards (server-side redirect)              │     │
│  └──────────────────────────────────────────────────────────────────┘     │
├──────────────────────────────────────────────────────────────────────────┤
│                         BUSINESS LOGIC LAYER                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐            │
│  │  Catalog   │ │  Commerce  │ │  Payments  │ │  Shipping  │            │
│  │  Module    │ │  Module    │ │  Module    │ │  Module    │            │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘            │
│        │              │              │              │                    │
├────────┴──────────────┴──────────────┴──────────────┴────────────────────┤
│                         DATA ACCESS LAYER                                │
│  ┌──────────────────┐  ┌───────────────┐  ┌──────────────────┐           │
│  │ Supabase Server  │  │ Supabase RLS  │  │ Supabase Client  │          │
│  │ (service_role)   │  │ (per-table)   │  │ (browser anon)   │          │
│  └──────────────────┘  └───────────────┘  └──────────────────┘           │
├──────────────────────────────────────────────────────────────────────────┤
│                         EXTERNAL SERVICES                                │
│  ┌────────┐ ┌───────────┐ ┌──────────┐ ┌────────┐ ┌────────┐            │
│  │ Stripe │ │Cloudinary │ │ Resend   │ │Couriers│ │Currency│            │
│  │Connect │ │ (media)   │ │ (email)  │ │ (4 APIs)│ │ (FX)  │           │
│  └────────┘ └───────────┘ └──────────┘ └────────┘ └────────┘            │
├──────────────────────────────────────────────────────────────────────────┤
│                         CLIENT STATE                                     │
│  ┌────────────────┐  ┌──────────────────┐                                │
│  │ Cart (Zustand)  │  │ Currency (Zustand)│                              │
│  │ + localStorage  │  │ + cookie fallback │                              │
│  └────────────────┘  └──────────────────┘                                │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Public Store | Catalog browsing, product detail, artisan profiles, SEO pages | SSG/ISR pages with `generateMetadata`, JSON-LD, filters |
| Artisan Dashboard | Piece CRUD, order fulfillment, balance/commission view, profile management | SSR pages with server actions, role guard in layout |
| Admin Panel | Piece moderation, artisan management, config, reporting | SSR pages with server actions, admin-only guard |
| Middleware | Session refresh, locale routing, auth cookie management | Edge middleware composing Supabase + next-intl |
| Catalog Module | Product queries, variant management, media handling, search/filter | `lib/` functions + Supabase queries + Cloudinary |
| Commerce Module | Cart-to-order conversion, coupon application, commission calc | Server actions + Zod validation + `commission.ts` |
| Payments Module | Stripe Connect integration, split payment, webhook processing | `lib/stripe/` + webhook route handlers + idempotency |
| Shipping Module | Courier quote aggregation, shipment tracking, status updates | `lib/couriers/` unified interface over 4 provider APIs |
| Data Access | Context-aware Supabase clients, RLS enforcement | Server/client factories with cookie management |
| Client State | Cart persistence, currency preference | Zustand stores with localStorage/cookie persistence |

## Recommended Project Structure

The existing structure is well-organized. No changes recommended; it already follows domain-driven organization within the Next.js App Router convention.

```
src/
├── app/
│   ├── [locale]/           # Public marketplace (SSG/ISR)
│   │   ├── catalogo/       # Catalog listing + detail
│   │   ├── artesanos/      # Artisan public profiles
│   │   ├── carrito/        # Cart (CSR)
│   │   ├── checkout/       # Checkout + confirmation (SSR)
│   │   ├── cuenta/         # Buyer account (SSR+CSR, auth guard)
│   │   └── auth/           # Login, register, OAuth callback
│   ├── artesano/           # Artisan dashboard (no locale, SSR, role guard)
│   ├── admin/              # Admin panel (no locale, SSR, role guard)
│   └── api/                # Route handlers (webhooks, integrations)
├── components/
│   ├── ui/                 # Primitives (button, input, dialog, etc.)
│   ├── catalog/            # Product card, grid, filters, gallery, 3D viewer
│   ├── cart/               # Cart sheet, cart items
│   ├── checkout/           # Checkout form, payment widgets, order summary
│   ├── artisan/            # Artisan card, profile header
│   └── layout/             # Header, footer, locale/currency switchers
├── lib/
│   ├── supabase/           # Client factories (server, browser, middleware)
│   ├── stripe/             # Stripe SDK + split payment logic
│   ├── cloudinary/         # Upload signatures + image transforms
│   ├── couriers/           # Unified shipping interface (4 providers)
│   ├── resend/             # Email client + React Email templates
│   ├── seo/                # Metadata + JSON-LD schema builders
│   └── utils/              # Commission, currency, slugify, format
├── store/                  # Zustand stores (cart, currency)
├── hooks/                  # Custom hooks (use-cart, use-currency, etc.)
└── types/                  # database.types.ts (auto-gen) + business types
```

### Structure Rationale

- **`app/[locale]/` vs `app/artesano/` vs `app/admin/`:** Dashboards do NOT need locale routing (internal tools). Only the public storefront is localized. This avoids unnecessary complexity in admin/artisan routes.
- **`lib/` by domain:** Each external service gets its own module. Business logic stays in `lib/utils/`. This prevents cross-domain coupling and makes testing individual integrations straightforward.
- **`components/` by feature:** Groups components by the page they serve, not by technical type. A developer working on checkout finds everything in `components/checkout/`.

## Architectural Patterns

### Pattern 1: Server-First with Selective Client Islands

**What:** Default to React Server Components for data fetching and rendering. Only promote to `"use client"` for interactive elements (cart drawer, filters, payment widgets).
**When to use:** Every page and component by default.
**Trade-offs:** Reduces client JS bundle significantly. Requires careful boundary planning -- a client component cannot import a server component. Data must be passed down as props or fetched independently.

**Example:**
```typescript
// src/app/[locale]/catalogo/[slug]/page.tsx — SERVER component (default)
export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug(params.slug) // direct DB call
  return (
    <div>
      <ProductGallery media={product.media} />         {/* server */}
      <ProductDetails product={product} />              {/* server */}
      <AddToCartButton product={product} />             {/* CLIENT island */}
    </div>
  )
}
```

### Pattern 2: Webhook-Driven State Machine

**What:** Order and payment state transitions are driven exclusively by verified webhook events, not by client-side polling or optimistic updates. The order state machine is: `pending_payment -> paid -> in_preparation -> shipped -> delivered` (+ `cancelled`). No state can be skipped.
**When to use:** All payment confirmation and order lifecycle transitions.
**Trade-offs:** Adds latency between payment and confirmation (seconds, not instant). But eliminates race conditions, double-charges, and inconsistent state. Idempotency by `event.id` prevents duplicate processing.

**Example:**
```typescript
// src/app/api/webhooks/stripe/route.ts
export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')!
  const event = stripe.webhooks.constructEvent(await req.text(), sig, secret)

  // Idempotency: check if event.id already processed
  const existing = await supabase
    .from('webhook_event')
    .select('id')
    .eq('event_id', event.id)
    .single()
  if (existing.data) return NextResponse.json({ received: true })

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object
    // Transition order: pending_payment -> paid
    // Calculate split, create transfer to artisan's connected account
    // Send confirmation email via Resend
  }

  // Record event as processed
  await supabase.from('webhook_event').insert({ event_id: event.id })
  return NextResponse.json({ received: true })
}
```

### Pattern 3: Commission-Config-Driven Split Payment

**What:** The platform commission percentage is never hardcoded. It lives in the `commission_config` table with an `effective_from` timestamp. At payment time, the system reads the currently active config and calculates the split. This allows changing commission rates without code deploys and maintains an audit trail.
**When to use:** Every payment calculation.
**Trade-offs:** Extra DB read per payment. Worth it for auditability and operational flexibility. Cache the config with a short TTL if volume grows.

**Example:**
```typescript
// src/lib/utils/commission.ts
export async function calculateSplit(basePrice: number) {
  const config = await getActiveCommissionConfig() // latest by effective_from
  const commissionAmount = basePrice * (config.commission_pct / 100)
  const artisanNet = basePrice - commissionAmount
  return { commissionAmount, artisanNet, configId: config.id }
}
```

### Pattern 4: Multi-Artisan Order Decomposition

**What:** A single order can contain items from multiple artisans. Each artisan ships their own items independently. This means one ORDER has multiple SHIPMENT records (one per artisan) and the split payment distributes funds to multiple connected Stripe accounts.
**When to use:** Checkout processing for any order with items from 2+ artisans.
**Trade-offs:** Increases complexity in order status display (order-level status vs shipment-level status). The order is only "delivered" when ALL shipments are delivered. The buyer sees per-artisan tracking.

## Data Flow

### Purchase Flow (Critical Path)

```
[Buyer browses catalog]
    |
    v
[Add to Cart] --> Zustand store (client-side, no server)
    |
    v
[Checkout Page] --> SSR: validate cart items still available
    |                   + fetch shipping quotes from couriers
    |                   + apply coupon if present
    v
[Submit Order] --> Server Action:
    |               1. Zod-validate all input
    |               2. Create ORDER + ORDER_ITEM + SHIPPING_ADDRESS
    |               3. Calculate commission via commission.ts
    |               4. Create Stripe PaymentIntent with transfer_data
    |               5. Return client_secret to frontend
    v
[Stripe Elements] --> Buyer completes payment in Stripe UI
    |
    v
[Stripe Webhook] --> POST /api/webhooks/stripe
    |               1. Verify signature
    |               2. Check idempotency (event.id)
    |               3. Update ORDER status: pending_payment -> paid
    |               4. Create PAYMENT record with split amounts
    |               5. Execute Stripe Transfer to artisan account(s)
    |               6. Create SHIPMENT record(s) per artisan
    |               7. Send confirmation email via Resend
    |               8. Revalidate relevant ISR pages
    v
[Confirmation Page] --> Buyer sees order details + tracking
```

### Piece Publication Flow

```
[Artisan creates piece]
    |
    v
[Draft] --> Artisan uploads media (Cloudinary signed upload)
    |        + fills metadata, variants, pricing
    v
[Submit for Review] --> status: draft -> pending_review
    |
    v
[Admin reviews] --> Approve: pending_review -> published
    |                         + trigger on-demand ISR revalidation
    |                         + send piece-approved email
    |               Reject: pending_review -> rejected
    |                         + send piece-rejected email
    |               Request changes: pending_review -> changes_requested
    v
[Published] --> Visible in public catalog (ISR-cached)
    |           + generateMetadata + JSON-LD for SEO
    v
[Sold] --> status: published -> sold
           + remains visible as portfolio (not purchasable)
```

### State Management Boundaries

```
SERVER STATE (source of truth):
  - User session (Supabase Auth cookies via middleware)
  - Order lifecycle (DB + webhook-driven transitions)
  - Product catalog (DB + ISR cache)
  - Commission config (DB)

CLIENT STATE (ephemeral, rehydratable):
  - Cart contents (Zustand + localStorage)
  - Currency preference (Zustand + cookie)
  - UI state (filter selections, modals, toasts)

HYBRID:
  - Auth state: Cookie-based session refreshed by middleware on every request.
    Client knows "am I logged in?" but server owns the session.
```

### Key Data Flows

1. **Cart to Order:** Client-side Zustand cart converts to server-side ORDER + ORDER_ITEM records at checkout. Cart is cleared after successful payment webhook. No server-side cart persistence needed for v1 (4-6 artisans, low concurrent volume).

2. **Split Payment Distribution:** Stripe captures full amount from buyer. Webhook handler calculates commission per `commission_config`, then creates a Stripe Transfer to each artisan's connected account for their `artisan_net` share. One order can produce multiple transfers if items span artisans.

3. **Media Pipeline:** Artisan uploads media via signed Cloudinary URL (generated by `/api/upload`). Cloudinary auto-converts to WebP/AVIF. Product references `cloudinary_id` in `product_media`. Public pages use Cloudinary transforms for responsive images.

4. **Shipping Quote Aggregation:** Checkout calls `/api/couriers/quote` which fans out to available courier APIs (Chilexpress, Starken for domestic; DHL, FedEx for international), normalizes responses, returns sorted options. Buyer selects one. Choice stored in `shipment.courier`.

5. **On-Demand Revalidation:** When admin approves a piece or artisan updates their profile, server action calls `/api/revalidate` with the affected paths. ISR cache invalidates, next visitor gets fresh page. Secured by `REVALIDATE_SECRET`.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 users (launch) | Current monolith is perfect. Supabase free/pro tier. Single Vercel deployment. Client-side cart in localStorage. No caching layer needed beyond ISR. |
| 100-10k users | Add Supabase connection pooling (Supavisor). Increase ISR revalidation intervals for less-changing pages. Add Redis/Upstash for rate-limiting webhook endpoints. Consider server-side cart for guest checkout recovery. |
| 10k+ users | Separate webhook processing into a queue (Inngest or QStash) to avoid timeout on Vercel serverless. Add Cloudinary CDN cache headers. Consider read replicas for catalog queries. Multi-region deployment. |

### Scaling Priorities

1. **First bottleneck:** Supabase connection limits under concurrent checkouts. Mitigate with connection pooling and serverless-friendly client config (`pgbouncer` mode).
2. **Second bottleneck:** Webhook processing time on Vercel (10s limit for serverless). If split payment + email + revalidation exceeds this, offload to background job queue.

## Anti-Patterns

### Anti-Pattern 1: Client-Side Order Creation

**What people do:** Create the order record from the client, then initiate payment.
**Why it's wrong:** Race condition between order creation and payment. Abandoned carts pollute the orders table. Client can manipulate prices.
**Do this instead:** Create order via server action at checkout submit. Only transition to `paid` via verified webhook. All price calculations happen server-side using DB values, never trusting client-submitted prices.

### Anti-Pattern 2: Hardcoded Commission Rates

**What people do:** `const COMMISSION = 0.15` scattered across codebase.
**Why it's wrong:** Cannot change rates without deploy. No audit trail. Different files can diverge.
**Do this instead:** Single source of truth in `commission_config` table. Read via `calculateSplit()` from `lib/utils/commission.ts`. Rates are versioned with `effective_from` timestamps.

### Anti-Pattern 3: Polling for Payment Confirmation

**What people do:** Client polls an endpoint every 2 seconds to check if payment succeeded.
**Why it's wrong:** Wastes resources, adds latency, unreliable under load. Can show "paid" before webhook processing completes.
**Do this instead:** Use Stripe's `return_url` redirect after payment. Confirmation page checks order status on load (server-side). If webhook hasn't processed yet, show "processing" state. Webhook is the canonical source of payment truth.

### Anti-Pattern 4: Single Order Status for Multi-Artisan Orders

**What people do:** One `shipped` status for an order with items from 3 artisans.
**Why it's wrong:** Artisan A ships in 1 day, Artisan B in 5 days. Order can't be "shipped" until all ship.
**Do this instead:** Order-level status reflects the aggregate (minimum progress across all shipments). Each `shipment` record has its own status per artisan. UI shows per-artisan tracking. Order becomes `delivered` only when all shipments are delivered.

### Anti-Pattern 5: Exposing Supabase service_role to Client

**What people do:** Use `service_role` key in browser client to bypass RLS for convenience.
**Why it's wrong:** Full database access from any browser. Complete security bypass.
**Do this instead:** Browser uses `anon` key. All elevated operations go through server actions or API routes that use `service_role` server-side only. RLS policies enforce row-level access for direct client queries.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Stripe Connect | Server-side SDK via `lib/stripe/`. PaymentIntent with `transfer_data` for splits. Webhooks for confirmation. | Artisans must complete Stripe onboarding before receiving payments. Store `stripe_account_id` on artisan record. |
| Cloudinary | Signed uploads via `/api/upload` route. Transformation URLs for responsive images. | Never upload from client directly -- always via signed URL. Respect `MAX_PHOTOS_PER_PRODUCT = 10`. |
| Resend + React Email | Server-side sends via `lib/resend/`. JSX templates in `lib/resend/templates/`. | Trigger from server actions and webhook handlers. Never from client components. |
| Courier APIs (4) | Unified interface in `lib/couriers/index.ts`. Each provider implements `quote()`. | APIs are external and unreliable. Implement timeouts, fallbacks, and graceful degradation if a provider is down. |
| Currency API | `/api/currency` route fetches CLP/USD rate. Display-only, never persisted. | Cache rate for 1-4 hours. Canonical prices always in CLP. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Public Store <-> Catalog Module | Direct import of server functions in RSC | No API boundary needed; same process |
| Cart (Client) <-> Commerce Module | Server action at checkout | Cart state lives client-side until checkout submit |
| Commerce Module <-> Payments Module | Server action calls `lib/stripe/split.ts` | Create PaymentIntent, then hands off to Stripe UI |
| Payments Module <-> Order Lifecycle | Webhook handler updates order status | Webhook is the ONLY way to transition `pending_payment -> paid` |
| Commerce Module <-> Shipping Module | Server action calls `lib/couriers/` at checkout | Quote at checkout; shipment created after payment confirmed |
| Admin Panel <-> Catalog Module | Server actions for piece approval/rejection | Triggers ISR revalidation on state change |
| Any Module <-> Email | Server-side call to `lib/resend/` | Triggered by state transitions (order paid, piece approved, etc.) |

## Build Order Recommendations

Component dependencies dictate the build sequence. Each layer depends on the one above it in this list:

### Tier 0: Foundation (must exist first)

1. **Database migrations + RLS policies** -- Everything depends on the data model. The 8 migration files exist but need validation and testing.
2. **Auth + Role system** -- User, Artisan, Buyer tables + layout guards. Every protected feature depends on knowing who the user is and what role they have.
3. **Supabase client factories** -- Server and browser clients with cookie management. Every data operation flows through these.

### Tier 1: Catalog (enables browsing)

4. **Product CRUD (artisan side)** -- Create/edit pieces with variants, media upload to Cloudinary, status management (draft state only at first).
5. **Admin piece moderation** -- Approve/reject workflow to transition pieces to `published`.
6. **Public catalog** -- SSG/ISR listing with filters, product detail page with gallery, artisan profile pages. Depends on products existing in `published` state.

### Tier 2: Commerce (enables buying)

7. **Cart** -- Zustand store + cart UI components. No server dependency, but needs product data to display.
8. **Checkout + Order creation** -- Server action to create order from cart, shipping address capture, coupon application.
9. **Stripe Connect integration** -- Artisan onboarding, PaymentIntent creation with split, webhook handler for payment confirmation.
10. **Shipping integration** -- Courier quote at checkout, shipment creation after payment, tracking.

### Tier 3: Operations (enables fulfillment)

11. **Order management (artisan side)** -- View incoming orders, update shipment status, mark as shipped.
12. **Order tracking (buyer side)** -- View order history, per-shipment tracking.
13. **Email notifications** -- Transactional emails for order lifecycle events.
14. **Admin reporting + commission config** -- Revenue dashboards, commission rate management.

### Build Order Rationale

- **Tier 0 before everything:** Without auth and data, nothing works. Validate migrations thoroughly since everything builds on this schema.
- **Catalog before Commerce:** Buyers need something to buy. Artisans need to list products before the checkout flow matters.
- **Commerce as a single phase:** Cart -> Checkout -> Payment -> Shipping are tightly coupled. Building them incrementally creates half-working flows that are hard to test.
- **Operations last:** Fulfillment features are only useful after orders exist. Email notifications enhance but don't enable the core flow.

## Sources

- Crisol project documentation: `docs/project_structure.md`, `docs/erd_core.html`, `docs/flow_purchase.html`, `docs/flow_split_payment.html`
- Crisol codebase architecture: `.planning/codebase/ARCHITECTURE.md`
- [Stripe Connect documentation](https://docs.stripe.com/connect)
- [Building a Scalable Multi-Vendor Marketplace: Technical Architecture 2026](https://needlecode.com/blog/web-dev/building-scalable-multi-vendor-marketplace.html)
- [How to Build a Handicraft Online Marketplace like Etsy](https://easternpeak.com/blog/how-to-build-a-handicraft-online-marketplace-like-etsy/)
- [E-commerce Architecture and System Design](https://www.geeksforgeeks.org/system-design/e-commerce-architecture-system-design-for-e-commerce-website/)
- [Multi Vendor Marketplace: Complete Guide 2026](https://acquirex.io/blog/multi-vendor-marketplace/)

---
*Architecture research for: Crisol artisanal jewelry marketplace*
*Researched: 2026-04-12*
