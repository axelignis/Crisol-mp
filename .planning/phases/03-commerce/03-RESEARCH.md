# Phase 3: Commerce - Research

**Researched:** 2026-05-09
**Domain:** E-commerce — cart, checkout, multi-vendor split payment, courier quoting, coupons
**Confidence:** MEDIUM-HIGH (HIGH for libs/patterns; MEDIUM for Stripe Connect Chile feasibility — FLAG-CRITICAL)

## Summary

Phase 3 implements the atomic commerce flow: persistent multi-artisan cart (Zustand + localStorage), single-page checkout with per-artisan shipping quotes (Chilexpress/Starken with timeout fallback), single-coupon-per-order discount, and Stripe Connect split payment using **Separate Charges & Transfers**. The order is created **only** on `payment_intent.succeeded` webhook with idempotency-by-`event.id` and immutable price/title snapshots.

Library stack is pinned and current — `stripe@17.1.0` (current 22.x is newer but breaking; stay on 17 unless plan upgrades), `@stripe/react-stripe-js@2.8.0`, `zustand@4.5.5`, `zod@3.23.8`, all already in `package.json`. Schema already exists from Phase 1 (migrations 003, 005, 007, 008): `order`, `order_item`, `payment`, `shipment`, `shipping_address`, `coupon`, `webhook_event`, `transition_order_status` RPC.

**Primary recommendation:** Build the webhook-first; treat the order as a server-side projection of confirmed payments. Use PaymentIntent `metadata.cart_snapshot_id` (pointing to a server-side staged cart record) rather than stuffing the cart into metadata directly (500-char limit per key).

**CRITICAL FLAG (must resolve before planning):** Stripe Connect's "Separate Charges & Transfers" is **not officially supported with Chile-based platforms** (current supported list: AU, CA, EU, JP, MY, NZ, SG, US per Stripe docs). The repo's `crisol.env.example` explicitly states the operating model is "Cuenta Stripe personal del admin (NO Stripe Connect) … neto del artesano se liquida manualmente". This **directly contradicts** CONTEXT.md D-07 (Separate Charges & Transfers) and COMR-06. Section "Stripe Connect Chile Feasibility" below documents the conflict and three resolution paths the discuss/planner phase must choose between.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Cart UX**
- D-01: Cart Sheet (slide-over) **y** página dedicada `/carrito` — sheet para vista rápida desde el header, página completa para edición detallada. Reusa el scaffold `cart-sheet.tsx`.
- D-02: Carrito persiste en `localStorage` para todos (guests y logged users) vía Zustand store `cart.store.ts`. Sin sincronización a DB esta fase. Cumple COMR-01.
- D-03: Carrito soporta piezas de múltiples artesanos en una sola orden (COMR-02). UI muestra agrupación visual por artesano dentro del carrito y resumen.

**Guest Checkout**
- D-04: Guest checkout permitido con email + datos de envío. Orden queda asociada al email; se ofrece "crear cuenta" como upsell opcional en la página de confirmación.
- D-05: Buyers registrados deben tener email verificado antes de poder pagar (carry-forward Phase 1, D-06). Guests reciben magic-link en confirmación para acceder al detalle del pedido.

**Stock Validation**
- D-06: Validación de stock en tres checkpoints: (1) al agregar al carrito, (2) al abrir checkout, (3) al confirmar el pago en el webhook. Decremento atómico de `product_variant.stock` ocurre en el webhook de pago confirmado para evitar oversell.

**Multi-Artisan Split Payment**
- D-07: Estrategia Stripe Connect: **Separate Charges & Transfers**. Una `PaymentIntent` cobrada por la plataforma (sin `transfer_data`/`destination`), seguida de `stripe.transfers.create` por cada artesano con su monto neto.
- D-08: Comisión calculada por `lib/utils/commission.ts` sobre el subtotal de cada artesano. Snapshot del `commission_pct` activo se guarda en `order.commission_pct_snapshot`.
- D-09: El costo de envío **no** entra en la base de cálculo de comisión — el envío va íntegro al artesano (o a la plataforma si la plataforma cobró el envío al buyer en su nombre — a confirmar en research; ver Open Questions).

**Shipping Quotes**
- D-10: Cotización **por artesano** — cada artesano tiene su propio shipment con courier y costo independientes.
- D-11: Couriers integrados en Phase 3: **Chilexpress y Starken** (nacional). Quote on-demand, timeout configurable (~5s).
- D-12: Fallback: tarifa plana por región desde tabla de configuración (admin-editable). Nunca bloquea el checkout. Cumple COMR-05.
- D-13: Phase 3 = solo Chile. DHL/FedEx scaffolds quedan vacíos.

**Coupons**
- D-14: El descuento aplica **solo al subtotal** (precios de piezas). El envío siempre se cobra completo.
- D-15: **La plataforma absorbe el descuento**: primero contra la comisión; si excede, la plataforma asume la diferencia. El artesano recibe el neto completo.
- D-16: **Un cupón por orden** — sin stacking. Validación: vigencia, `uses_limit`, `min_order`, `is_active`.
- D-17: Códigos privados administrados por admin (CRUD admin completo se difiere a Phase 5). Esta fase necesita el mínimo para QA — TBD vía seed o panel mínimo.

**Checkout Flow**
- D-18: Layout single-page con secciones scrolleables: Contacto → Dirección → Método de envío → Cupón → Pago (Stripe Elements) → Resumen sticky a la derecha.
- D-19: Disclaimers (no devoluciones COMR-03 + impuestos internacionales COMR-09) renderizados **inline justo arriba del botón "Pagar"** con **checkbox de aceptación obligatorio**. Botón Pagar deshabilitado hasta marcar.
- D-20: Snapshot inmutable: al crear el `order` desde el webhook, copiar `snapshot_title` y precio (con modificador de variante) en cada `order_item`. Cumple COMR-08.

**Stripe Webhook**
- D-21: Webhook `/api/webhooks/stripe` verifica firma con `stripe.webhooks.constructEvent` y aplica idempotencia consultando/insertando en `webhook_event` por `event.id` antes de procesar. Cumple COMR-07.
- D-22: El pedido se crea **solo** al recibir `payment_intent.succeeded` — nunca antes. Pre-pago no existe registro en tabla `order`.

**Post-Payment UX**
- D-23: Página de éxito: redirect a `/pedido/{order_id}` mostrando # de pedido, items, total, ETA por artesano, confirmación de email. Para guests, link incluye token firmado.
- D-24: Email transaccional de confirmación de pago se dispara desde el webhook (Resend). Templates específicos de transiciones se definen en Phase 4; esta fase entrega `order-confirmed.tsx` mínimo.

**Crypto Payment**
- D-25: **Diferido**. Coinbase Commerce no se integra en Phase 3.

### Claude's Discretion

- Estructura URL exacta de `/carrito` y query params del checkout
- Diseño visual del cart sheet (animaciones, badge contador en header)
- Stripe Elements UI customization (theme matching brand)
- Copy exacto de disclaimers y mensajes de error de cupón/stock
- Manejo de retry de pago fallido (UI feedback)
- Estructura del email `order-confirmed.tsx` (template inicial)
- Cron/cleanup de carritos abandonados (no requerido esta fase)
- Implementación de magic-link para guest order access
- Diseño de empty state del carrito
- Agrupación visual por artesano en cart sheet vs carrito page

### Deferred Ideas (OUT OF SCOPE)

- Coinbase Commerce / crypto payment — fase futura (post Phase 5)
- Envío internacional (DHL, FedEx)
- CRUD completo admin de cupones — Phase 5
- Soft-reserve de stock con TTL — optimización futura
- Carrito sincronizado a DB para logged users
- Galería pública de cupones / auto-apply
- Express checkout (Apple Pay / Google Pay / saved cards)
- Manejo avanzado de refunds y splits inversos — Phase 4+
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMR-01 | Visitante puede agregar piezas al carrito (Zustand + localStorage) | Zustand `persist` middleware section; cart store pattern below |
| COMR-02 | Carrito multi-artesano en una sola orden | Separate Charges & Transfers pattern (one PI, N transfers) |
| COMR-03 | Aviso no devoluciones antes de confirmar | UI checkout pattern; checkbox + disabled button |
| COMR-04 | Checkout solicita dirección y muestra cotización courier | Couriers section: Chilexpress quote API, Starken POST quote API |
| COMR-05 | Cotización Chilexpress/Starken con timeout y fallback flat rate | Section "Couriers" — `Promise.race` with timeout, region flat-rate table |
| COMR-06 | Pago Stripe Connect con split (comisión admin, neto artesano) | **CRITICAL FLAG** — see Stripe Connect Chile Feasibility |
| COMR-07 | Webhook firma + idempotencia por event.id | Webhook section — `constructEvent`, `webhook_event` PK insert |
| COMR-08 | Pedido se crea al confirmar pago con snapshot inmutable | Webhook handler creates order + order_items with `snapshot_title`, `unit_price` (price+modifier) |
| COMR-09 | Aviso impuestos internacionales en checkout | Inline disclaimer + accept checkbox (D-19); only show when shipping outside CL (currently blocked D-13 — show as legal-coverage disclaimer regardless) |
| COUP-01 | Admin crea cupón con tipo, límite, expiración | Schema exists in `coupon` table; minimum admin-seed or panel covered by D-17 |
| COUP-02 | Comprador aplica código en checkout | Server action validates against `coupon` row, returns discount preview |
| COUP-03 | Sistema valida vigencia, límite usos y reglas | Validation rules: `is_active`, `expires_at > now()`, `uses_count < uses_limit`, `min_order <= subtotal` |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cart state (add/remove/qty) | Browser (Zustand + localStorage) | — | Pure client state per D-02; no DB sync this phase |
| Cart badge / sheet UI | Browser | — | Client component listening to Zustand store |
| Stock check on add-to-cart | API / Backend | Browser (UI feedback) | Authoritative read of `product_variant.stock` via server action |
| Stock check on checkout open | API / Backend | — | Server-rendered checkout fetches latest stock |
| Stock decrement (atomic) | Database / Storage | API (webhook) | Webhook calls SQL function holding row locks; only source of truth |
| Address form | Browser | API (Zod-validated submit) | Standard form |
| Courier quote fetch | API / Backend | Browser (debounced trigger) | Server route hides courier API keys; applies timeout + flat-rate fallback |
| Coupon validation | API / Backend | — | Server action queries `coupon` table; never trust client-side discount |
| Stripe Elements UI | Browser | API (PaymentIntent create) | Stripe.js renders card UI; secret key never on client |
| PaymentIntent create | API / Backend | — | Server route creates PI with metadata pointing to staged cart |
| Webhook handler | API / Backend | Database (RPC) | Verifies signature, idempotency insert, calls `transition_order_status` |
| Order creation | Database / Storage | API (orchestration) | Created by webhook handler in transaction; immutable snapshots |
| Stripe transfers to artisans | API / Backend | — | Issued post-PI-success, tied to `source_transaction = charge.id` |
| Order confirmation email | API / Backend (Resend) | — | Triggered from webhook after order persisted |
| `/pedido/{id}` page | Frontend Server (RSC) | API (token verification for guests) | Server component fetches order; guest token validated server-side |

## Standard Stack

### Core (already in package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | 17.1.0 | Server-side Stripe SDK (PaymentIntent, transfers, webhook construct) | Official Stripe Node SDK [VERIFIED: package.json] |
| @stripe/stripe-js | 4.6.0 | Stripe.js loader for browser | Required for Elements [VERIFIED: package.json] |
| @stripe/react-stripe-js | 2.8.0 | React bindings for Elements | Official React wrapper [VERIFIED: package.json] |
| zustand | 4.5.5 | Cart state with `persist` middleware | Aligns with D-02; tiny, no provider [VERIFIED: package.json] |
| zod | 3.23.8 | Validate API input (cart, address, coupon, webhook payload echo) | CLAUDE.md mandates Zod for external input [VERIFIED] |
| @supabase/ssr | 0.5.1 | Server client with cookie session | Existing convention [VERIFIED] |
| @supabase/supabase-js | 2.45.4 | Client/admin SDK | Existing [VERIFIED] |
| resend | 4.0.0 | Order confirmation email | Existing convention [VERIFIED] |
| @react-email/components | 0.0.25 | `order-confirmed.tsx` template | Existing convention [VERIFIED] |
| react-hook-form + @hookform/resolvers | 7.72 / 5.2 | Checkout multi-section form with Zod resolver | Already used in piece wizard [VERIFIED] |
| sonner | 2.0.7 | Toast feedback (cart added, coupon applied, errors) | Existing [VERIFIED] |

**Version note:** `stripe` package current latest is 22.1.1 [VERIFIED: `npm view stripe version`]. Project pins 17.1.0. **Recommendation:** stay on 17.x for Phase 3 (no breaking change risk); the Stripe API version sent in requests is what matters for behavior. Pin a specific Stripe API version explicitly in client construction (e.g., `apiVersion: '2024-06-20'`) — do not let Stripe auto-upgrade.

### Supporting (no install needed)

| Helper | Purpose |
|---------|---------|
| Existing `lib/utils/commission.ts` | `calculateSplit(amount, pct)` — already TDD'd, integer-safe |
| Existing `lib/utils/clp.ts` | `clp()`, `clpAdd`, `clpSubtract`, `clpPercentFloor` — branded type CLP |
| Existing `transition_order_status` RPC | Use to advance `pending_payment → paid`; idempotency partner |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe Elements (custom flow) | Stripe Checkout (hosted) | Hosted is faster but loses inline UX (D-18 single-page layout); reject |
| Separate Charges & Transfers | Destination Charges with `transfer_data.destination` | Single-destination only — incompatible with multi-artisan cart (COMR-02). Reject |
| Separate Charges & Transfers | Direct Charges (charge on connected account) | Cannot route a single buyer charge across N sellers. Reject |
| `stripe.webhooks.constructEvent` | Manual signature verification | Stripe SDK handles timestamp tolerance correctly; never hand-roll [CITED: docs.stripe.com/webhooks/signature] |
| Cart in DB | Cart in localStorage | D-02 locks it. Future enhancement deferred |

**Installation:**
```bash
# Nothing to install — all required deps already in package.json.
# Verify with: pnpm install
```

## Architecture Patterns

### System Architecture Diagram

```
[Browser]
  ├── Cart Sheet / /carrito  ─── reads ──▶ Zustand cart.store (localStorage)
  │                                          │
  │                                          ▼ (on add)
  │                                       Server action: stock-check (Supabase)
  │
  └── /checkout (single-page form)
        │ ─── address change ───▶ POST /api/couriers/quote ──▶ Chilexpress / Starken
        │                              │ (5s timeout)
        │                              └─▶ flat-rate fallback (commission_config)
        │ ─── coupon apply ───▶ Server action: validate-coupon (coupon table)
        │ ─── submit ───▶ POST /api/checkout/payment-intent
        │                       │
        │                       ▼ (server) Stage cart snapshot in temp table OR
        │                                  use PI metadata with cart_id pointing to
        │                                  redis/staged record. Create PI, return client_secret
        │                       │
        │ ◀── client_secret ────┘
        │ ─── confirm card via stripe.js ───▶ [Stripe Elements]
        │
        ▼ (3DS / success)
   Redirect /pedido/{id}?token=...

[Stripe] ──── webhook ────▶ POST /api/webhooks/stripe
                                  │
                                  ├── stripe.webhooks.constructEvent(rawBody, sig, secret)
                                  ├── INSERT INTO webhook_event(id) ON CONFLICT DO NOTHING
                                  │       └── if conflict → return 200 (already processed)
                                  ├── BEGIN TX
                                  │   ├── Re-validate cart_snapshot vs stock (row lock product_variant)
                                  │   ├── INSERT order (status='pending_payment')
                                  │   ├── INSERT order_item × N (snapshot_title, unit_price+modifier)
                                  │   ├── INSERT shipping_address
                                  │   ├── INSERT shipment × M (one per artisan)
                                  │   ├── INSERT payment (stripe_payment_intent_id)
                                  │   ├── UPDATE product_variant SET stock = stock - qty
                                  │   ├── UPDATE coupon SET uses_count = uses_count + 1 (if any)
                                  │   ├── SELECT transition_order_status(order_id, 'paid', system)
                                  │   └── COMMIT
                                  ├── For each artisan group:
                                  │     stripe.transfers.create({
                                  │       amount: artisan_net_clp,
                                  │       currency: 'clp',
                                  │       destination: artisan.stripe_account_id,
                                  │       source_transaction: charge.id,   // ties to settled charge
                                  │       transfer_group: order.id          // bookkeeping
                                  │     })
                                  ├── UPDATE payment SET stripe_transfer_id = ...
                                  ├── Resend.send(order-confirmed.tsx) (best-effort, log failures)
                                  └── return 200
```

### Recommended Project Structure

```
src/
├── store/
│   └── cart.store.ts                      # Zustand + persist middleware (skipHydration)
├── hooks/
│   ├── use-cart.ts                        # Selectors / actions wrapper for cart store
│   └── use-cart-hydration.ts              # SSR-safe hydration gate (returns hydrated:boolean)
├── components/
│   ├── cart/
│   │   ├── cart-sheet.tsx                 # Slide-over (existing scaffold)
│   │   ├── cart-item.tsx                  # Existing scaffold
│   │   ├── cart-empty.tsx                 # Empty state
│   │   ├── cart-artisan-group.tsx         # Grouping by artisan
│   │   └── cart-badge.tsx                 # Header counter
│   └── checkout/
│       ├── checkout-form.tsx              # Multi-section form orchestrator
│       ├── checkout-contact.tsx           # Email + (auth-gate for buyers)
│       ├── checkout-address.tsx           # Address form, triggers quote
│       ├── checkout-shipping.tsx          # Per-artisan courier picker
│       ├── checkout-coupon.tsx            # Apply/remove single coupon
│       ├── checkout-disclaimers.tsx       # No-returns + intl-tax + checkbox
│       ├── order-summary.tsx              # Sticky right (existing scaffold)
│       └── payment-stripe.tsx             # Elements wrapper (existing scaffold)
├── lib/
│   ├── stripe/
│   │   ├── client.ts                      # Server stripe SDK instance
│   │   ├── client-browser.ts              # loadStripe singleton for client
│   │   └── split.ts                       # buildTransfers(orderItems, commission_pct) → Transfer[]
│   ├── couriers/
│   │   ├── index.ts                       # quote(courier, params) facade with timeout+fallback
│   │   ├── chilexpress.ts                 # POST https://testservices.wschilexpress.com/rating/api/v1.0/rates
│   │   ├── starken.ts                     # POST https://gateway.starken.cl/quote/cotizador
│   │   └── flat-rate.ts                   # Region → CLP fallback table reader
│   ├── checkout/
│   │   ├── totals.ts                      # Pure calc: subtotal, discount, shipping, commission, total
│   │   ├── stage-cart.ts                  # Persist cart snapshot keyed by id (DB or stripe metadata)
│   │   └── coupon.ts                      # validateCoupon(code, subtotal) → {valid, discount, reason}
│   └── orders/
│       ├── create-from-payment.ts         # Webhook-side: build order+items+shipments transactionally
│       └── stock-check.ts                 # Re-validate stock at checkout open + webhook
├── app/
│   ├── [locale]/
│   │   ├── carrito/page.tsx               # Full cart page (existing scaffold)
│   │   ├── checkout/page.tsx              # Checkout (existing scaffold)
│   │   ├── checkout/confirmacion/page.tsx # Post-redirect interim (existing)
│   │   └── pedido/[id]/page.tsx           # Order detail (RSC, guest-token aware)
│   └── api/
│       ├── checkout/
│       │   ├── payment-intent/route.ts    # POST: stage cart, create PI, return client_secret
│       │   └── coupon/route.ts            # POST: validate coupon (or use server action)
│       ├── couriers/quote/route.ts        # POST: courier quote (existing scaffold to fill)
│       └── webhooks/stripe/route.ts       # POST: webhook handler (existing scaffold)
└── messages/
    ├── es/checkout.json                   # i18n strings (es default)
    └── en/checkout.json                   # Skeleton (en may be incomplete)
```

### Pattern 1: Zustand Cart Store with SSR-safe Persist

**What:** Cart store using `persist` middleware against `localStorage`, with explicit hydration gate to avoid Next.js hydration mismatch.

**When to use:** All cart access in client components.

**Example (skeleton pattern, do not copy verbatim):**
```typescript
// src/store/cart.store.ts
// Pattern: persist + skipHydration; trigger rehydrate from <CartHydration/> client component
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type CartItem = {
  productId: string
  variantId: string
  artisanId: string
  title: string         // snapshot for cart display only — server re-fetches at checkout
  unitPrice: number     // CLP integer (price + variant modifier)
  qty: number
}
type CartState = {
  items: CartItem[]
  add: (item: CartItem) => void
  remove: (variantId: string) => void
  setQty: (variantId: string, qty: number) => void
  clear: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => set((s) => mergeItem(s.items, item)),
      remove: (variantId) => set((s) => ({ items: s.items.filter(i => i.variantId !== variantId) })),
      setQty: (variantId, qty) => set((s) => ({
        items: s.items.map(i => i.variantId === variantId ? { ...i, qty } : i),
      })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'crisol.cart.v1',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,        // critical for SSR
      version: 1,
    },
  ),
)
```
Source: pattern verified against [zustand persist docs](https://github.com/pmndrs/zustand) and Next.js hydration discussion thread.

### Pattern 2: Single-Source-of-Truth Pricing on Server

**What:** All money math (subtotal, discount, shipping, commission, total) recomputed on the server at PaymentIntent creation and again on webhook. Client values are display-only.

**When to use:** Always. Never trust client-submitted totals.

**Pattern:**
- Client posts `[{ variant_id, qty }]` + address + coupon code.
- Server: fetch `product_variant.price + product.base_price` per row, multiply by qty, sum subtotal per artisan, compute commission via `calculateSplit`, query/validate coupon, fetch quotes, compute total. Cache snapshot keyed by `cart_snapshot_id` (suggest: insert into a short-lived `cart_snapshot` table tied to the email/user, expire 30 min).
- PI created with `metadata.cart_snapshot_id` only (Stripe metadata limit: 50 keys × 500 chars each — never store full cart inline).

### Pattern 3: Webhook as Order Creator

**What:** No `order` row exists until `payment_intent.succeeded` fires.

**Why:** Eliminates orphaned pending orders, simplifies state machine (no pre-payment → cancelled cleanup), aligns with Stripe's recommendation to fulfill from webhooks.

**Pattern:** See diagram above. Key constraints:
- Use `await req.text()` (NOT `req.json()`) — `constructEvent` requires raw body [CITED: dev.to/whoffagents/stripe-webhook-security].
- `INSERT INTO webhook_event(id) ON CONFLICT DO NOTHING` then check `rowCount` — if 0, already processed, return 200 immediately.
- All DB writes in single transaction. If `stripe.transfers.create` fails after order is committed, log + retry async (do not roll back the order; payment succeeded).

### Pattern 4: Per-Artisan Shipment from One Order

**What:** Single `order` row, multiple `shipment` rows (one per artisan) created at the webhook.

**Why:** Aligns with D-10 (per-artisan quote) and Phase 4 fulfillment model (each artisan tracks own shipment).

**Quote-to-shipment data flow:** When the user picks a courier per artisan group in checkout UI, the chosen `{artisan_id, courier, cost}` triples are sent in the PI request body and stored in `cart_snapshot`. Webhook reads them back to insert the `shipment` rows.

### Pattern 5: Idempotency Both Sides

**What:** Idempotency at two layers:
1. Stripe-side: pass `Idempotency-Key` header on `paymentIntents.create` and `transfers.create` to make retried API calls safe [CITED: docs.stripe.com/api/idempotent_requests].
2. Webhook-side: `webhook_event.id` PK insert prevents reprocessing on retry.

**Idempotency-Key recommendation:** Use a deterministic key derived from `cart_snapshot_id` + an action suffix:
- `paymentIntents.create` → `pi:{cart_snapshot_id}`
- `transfers.create` (webhook side, per artisan) → `tr:{order_id}:{artisan_id}`

### Anti-Patterns to Avoid

- **Reading `await req.json()` in webhook before `constructEvent`** — corrupts raw body, signature fails. Always `await req.text()`.
- **Trusting client-submitted prices, totals, or commission percentages** — recompute server-side from canonical sources. Client is display-only.
- **Storing the full cart in PaymentIntent metadata** — 500-char limit per key, 50 keys; can silently truncate. Use `cart_snapshot_id` only.
- **Creating the order before payment confirmation** — leaves orphaned `pending_payment` rows; complicates recovery. D-22 forbids this.
- **Synchronous heavy work in webhook handler** — Stripe times out at ~30s. Keep transaction tight; queue email + transfers if needed (or do them inline if fast).
- **Floating-point arithmetic on CLP** — use existing `clp.ts` integer helpers exclusively. CLP is zero-decimal.
- **Decrementing stock at add-to-cart or checkout open** — only at webhook (race-safe via row locks). Otherwise abandoned carts deplete inventory.
- **Saving the discount inside `commission_amount`** — D-15 says platform absorbs discount: subtract discount from commission first, then from platform if it exceeds; never reduce `artisan_net`.
- **Using `transfer_data.destination` on PI for multi-artisan** — incompatible with multi-vendor; locks PI to one connected account.
- **Forgetting `source_transaction` on transfers** — without it, transfer attempts to draw from platform balance immediately, may fail before charge settles. Always tie transfer to `charge.id`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Manual HMAC compare | `stripe.webhooks.constructEvent(body, sig, secret)` | Handles timestamp tolerance, replay window, multiple secrets [CITED: stripe docs] |
| CLP money math | Custom rounding | Existing `lib/utils/clp.ts` + `commission.ts` | Already TDD'd with invariant tests |
| Coupon discount calc | Inline math | Wrap in `lib/checkout/coupon.ts` reusing `clpPercentFloor` | Consistency + testability |
| Persistent local state | Custom localStorage hooks | Zustand `persist` middleware | Handles hydration, versioning, rehydration |
| Form validation | Custom validators | `zod` + `react-hook-form` + `@hookform/resolvers/zod` | Already pattern in piece wizard |
| Stripe.js loader | Multiple `loadStripe` calls | Singleton in `lib/stripe/client-browser.ts` | Multiple loads cause warnings; documented Stripe pattern |
| Idempotency keys | UUIDv4 per request | Deterministic key from cart_snapshot_id | Retried calls hit same key → Stripe deduplicates |
| Address country list | Hardcoded array | Phase 3 = CL only (D-13); use single-option select | Avoids scope creep |

## Runtime State Inventory

> Phase 3 is greenfield commerce on top of existing schema — but it does introduce new persistent state. Inventory below for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New: `cart_snapshot` table (or equivalent staging) for PI metadata reference; `webhook_event` PK reuse for idempotency. New rows in `order`, `order_item`, `payment`, `shipment`, `shipping_address`, `coupon.uses_count` increment, `product_variant.stock` decrement | Plan must decide: new migration for `cart_snapshot` table OR reuse Redis/in-memory with TTL. Recommend new migration with `expires_at` + cleanup cron deferred to Phase 5 |
| Live service config | Stripe Webhook endpoint to register in dashboard pointing to `/api/webhooks/stripe`; events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded` (latter for Phase 4). Coupon seed rows for QA per D-17 | Manual: create webhook endpoint in Stripe Dashboard for both test and live; capture `STRIPE_WEBHOOK_SECRET` per env. Coupon seed: add to `supabase/migrations/` or seed script |
| OS-registered state | None | None |
| Secrets/env vars | Existing in `crisol.env.example`: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `CHILEXPRESS_API_KEY`, `CHILEXPRESS_COD_CUENTA`, `STARKEN_USER`, `STARKEN_PASSWORD`. **Conflict:** env example says "NO Stripe Connect" — must reconcile with D-07 (see Critical Flag) | Update `crisol.env.example` comment block; add Stripe Connect account creation flow note OR reverse the architecture per resolution chosen |
| Build artifacts | `src/types/database.types.ts` may need regeneration if `cart_snapshot` migration added | Run `pnpm db:types` after migration |

## Stripe Connect Chile Feasibility (CRITICAL FLAG)

This is the single most important finding for the planner.

### The conflict

- **CONTEXT.md D-07 + ROADMAP COMR-06:** Use Stripe Connect with Separate Charges & Transfers; `payment.stripe_transfer_id` populated.
- **`crisol.env.example` lines 34-38:** "MODELO DE PAGOS: Cuenta Stripe personal del admin (NO Stripe Connect). El admin recibe el 100% de cada venta. … El neto de cada artesano se liquida manualmente via transferencia bancaria y se registra en la tabla ARTISAN_PAYOUT."
- **STATE.md blockers:** "Stripe Connect Express account availability for Chilean artisans needs confirmation before designing onboarding flow."

### What the docs say

- Stripe Connect "Separate Charges and Transfers" charge type is **regionally limited** to AU, CA, EU, JP, MY, NZ, SG, US for the platform account [CITED: docs.stripe.com/connect/integration-recommendations]. Chile is **not on the list**.
- Stripe is not directly available to businesses incorporated in Chile in standard onboarding; common workaround is a US LLC. [CITED: stripe.com/global, doola/incorpuk articles]
- Stripe's "Global Payouts" (cross-border payouts) added support for additional countries in early 2026 changelog, but this is for payouts to Stripe-supported destinations, not platform onboarding [CITED: docs.stripe.com/changelog/clover/2026-01-28].
- Express connected accounts list does include Chile in some availability tables, but the platform-account country still must be in the supported list to use Separate Charges & Transfers.

Confidence: **MEDIUM**. Web search results are not authoritative on the exact current preview status. **The team must verify with Stripe support** (action: STATE.md blocker resolution) before committing to D-07.

### Three resolution paths

The planner / discuss phase MUST pick one before the executor builds:

**Path A — Confirmed Stripe Connect available (preferred per D-07):**
- Platform Stripe account in supported region (likely US LLC or via Stripe Atlas).
- Each artisan onboards as Express connected account (Chile destination supported for Express in some configurations).
- Webhook issues `stripe.transfers.create` per artisan with `source_transaction: charge.id`.
- Schema is ready: `payment.stripe_transfer_id`, `artisan_payout.stripe_payout_id`.
- **Risk:** confirmation of preview-feature access required from Stripe.

**Path B — Single Stripe account, manual artisan payouts (matches current env example):**
- Platform charges 100% to admin's personal Stripe account.
- No `stripe.transfers.create`; admin runs reconciliation report from `order_item` aggregations and pays artisans via bank transfer.
- `artisan_payout` table tracks payouts; `payment.stripe_transfer_id` becomes nullable / unused.
- **Cost:** D-07 / COMR-06 wording must be revised; CONTEXT.md needs an addendum. The functional outcome (commission + artisan net tracked correctly) is preserved — but COMR-06 says "split automático" which is no longer literally automatic.

**Path C — Hybrid: Stripe Connect-shaped code, manual transfers behind feature flag:**
- Implement the Separate Charges & Transfers code path but disable transfer execution behind `ENABLE_STRIPE_TRANSFERS=false`.
- In disabled mode, write the would-be transfer parameters to `artisan_payout` for manual processing.
- Allows Phase 3 to ship even if Stripe Connect access isn't confirmed; flips to live behavior with one env var when access is granted.
- **Recommended** if access is uncertain at planning time — preserves the architectural intent without blocking the phase.

**Planning action required:** Discuss-phase or planner must choose A/B/C and note the choice in PLAN.md Decision section. If C, plan must include both code paths.

## Couriers — Verified API Details

### Chilexpress

- Developer portal: `https://developers.wschilexpress.com/` [VERIFIED: web search]
- APIs of interest for Phase 3:
  - **Coverage** — validate destination address (region/comuna codes)
  - **Quoter (Cotizador)** — quote shipment by dimensions (cm), weight (kg), origin coverage, destination coverage
- Sandbox: subscription keys per API obtained via the portal; test environment available before production switch.
- Auth: `Ocp-Apim-Subscription-Key` header per API.
- Endpoint shape (legacy reference, confirm in current portal docs): `POST https://testservices.wschilexpress.com/rating/api/v1.0/rates/{...}` — confidence: MEDIUM (URL structure changes; planner must read the portal directly during Wave 0).

### Starken

- Integration page: `https://www.starken.cl/integraciones` [VERIFIED: web search]
- Quote endpoint: `POST https://gateway.starken.cl/quote/cotizador` [CITED: web search summary]
- Body params: `alto`, `ancho`, `largo` (cm), `bulto`, `destino`, `entrega`, `kilos`, `origen`, `servicio`.
- Auth: `STARKEN_USER` + `STARKEN_PASSWORD` (Basic auth or token-exchange — confirm in docs).
- **Confidence: LOW-MEDIUM.** Public docs are sparse; some online references are obsolete (Turbus Cargo era). **Action required:** Wave 0 task = make a manual sandbox request to confirm endpoint, auth, response shape. Have a Postman / curl test ready before writing code.

### Pattern: Quote-with-timeout

```typescript
// src/lib/couriers/index.ts (skeleton)
const TIMEOUT_MS = 5000

export async function quote(courier: 'chilexpress' | 'starken', params: QuoteParams): Promise<QuoteResult> {
  try {
    const result = await Promise.race([
      courier === 'chilexpress' ? quoteChilexpress(params) : quoteStarken(params),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS),
      ),
    ])
    return { source: courier, ...result }
  } catch (err) {
    // Log to console; surface fallback
    console.error(`[couriers] ${courier} failed`, err)
    return await flatRateFallback(params)
  }
}
```

Plus per-artisan fan-out: when checkout has items from N artisans with different origin comunas, run quotes in parallel and merge results.

## Common Pitfalls

### Pitfall 1: Hydration mismatch from Zustand `persist`

**What goes wrong:** Reading `cart.items` directly in a component that renders on both server (empty) and client (populated from localStorage) causes hydration mismatch warning and visual flicker.

**Why it happens:** Server has no localStorage; first client render reads from store; persist middleware rehydrates after mount.

**How to avoid:** Use `skipHydration: true` in persist options, then call `useCartStore.persist.rehydrate()` from a client component mounted at the layout root. Components reading cart state should use a `useHydrated()` gate that returns `false` on server and first client render, `true` after `useEffect`.

**Warning signs:** Console "Hydration failed" warning; cart counter renders 0 then jumps to N.

### Pitfall 2: Webhook body parsed as JSON before signature verification

**What goes wrong:** Stripe signature verification fails with "No signatures found matching the expected signature".

**Why it happens:** Next.js App Router's `req.json()` consumes the body stream and returns parsed object; signature verification needs the raw bytes.

**How to avoid:** In the webhook route, `const body = await req.text()` first, then `const event = stripe.webhooks.constructEvent(body, sig, secret)`. Don't read body before `constructEvent`.

**Warning signs:** Webhook returns 400 with signature error; events show "failed" in Stripe dashboard.

### Pitfall 3: PaymentIntent metadata size overflow

**What goes wrong:** Stuffing the full cart into PI metadata silently truncates at 500 chars per key (or fails outright if over 50 keys), causing webhook to lose data.

**How to avoid:** Use `metadata: { cart_snapshot_id: '...' }` referencing a server-side staged cart row.

**Warning signs:** Webhook receives PI with metadata, but order_items have wrong values or are missing.

### Pitfall 4: Concurrent purchase → oversell

**What goes wrong:** Two buyers complete checkout for last-stock variant; both webhooks fire; both decrement stock; one ends up at -1.

**How to avoid:** In webhook transaction, use `SELECT … FROM product_variant WHERE id = $1 FOR UPDATE` and check stock before decrement; if insufficient, refund the payment via `stripe.refunds.create` and notify buyer. (Phase 3 minimum: detect and refund; UX polish in Phase 4.)

**Warning signs:** Negative stock values in `product_variant.stock`.

### Pitfall 5: Transfer fails because charge not yet settled

**What goes wrong:** `stripe.transfers.create` succeeds API-side but funds not actually moved because charge is in transit.

**How to avoid:** Always pass `source_transaction: charge.id` to bind the transfer to the underlying charge — Stripe guarantees the transfer waits for charge settlement.

**Warning signs:** Connected account balance lags expected amounts; reconciliation reports show drift.

### Pitfall 6: Coupon double-use under concurrency

**What goes wrong:** Two webhooks process orders that both used the last available coupon use; both increment `uses_count` past `uses_limit`.

**How to avoid:** Update with conditional: `UPDATE coupon SET uses_count = uses_count + 1 WHERE id = $1 AND (uses_limit IS NULL OR uses_count < uses_limit) RETURNING uses_count`. If 0 rows returned, treat as expired (refund or apply zero discount — choose one and document; recommendation: refund + notify).

**Warning signs:** `uses_count > uses_limit` rows in `coupon` table.

### Pitfall 7: Stripe API version drift

**What goes wrong:** New Stripe API version (auto-applied at account level) changes response shapes; webhook handler breaks silently.

**How to avoid:** Pin `apiVersion` in the SDK constructor: `new Stripe(secret, { apiVersion: '2024-06-20' })`. Update intentionally with tests.

### Pitfall 8: Forgetting CLP integer constraints

**What goes wrong:** `unit_price * 1.19` produces a float; `clp()` constructor throws.

**How to avoid:** Always go through `clpPercentFloor` / `clpMultiply`. Never use raw arithmetic on CLP values.

## Code Examples

### Verifying a Stripe webhook (Next.js 14 App Router)
```typescript
// src/app/api/webhooks/stripe/route.ts
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createServiceRoleClient } from '@/lib/supabase/admin'  // service-role server client

export async function POST(req: Request) {
  const body = await req.text()                           // raw body — DO NOT use req.json()
  const sig = req.headers.get('stripe-signature') ?? ''
  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('[stripe-webhook] signature verification failed', err.message)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  // Idempotency
  const supabase = createServiceRoleClient()
  const { error: idemErr } = await supabase
    .from('webhook_event')
    .insert({ id: event.id, source: 'stripe', event_type: event.type, payload: event as any })
  if (idemErr?.code === '23505') {
    // duplicate event — already processed
    return NextResponse.json({ received: true, duplicate: true })
  }
  if (idemErr) {
    console.error('[stripe-webhook] idempotency insert failed', idemErr)
    return NextResponse.json({ error: 'idempotency-store-failed' }, { status: 500 })
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object)
      break
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object)
      break
    // refunds, disputes → Phase 4
  }

  return NextResponse.json({ received: true })
}
```
Source: pattern from [Stripe webhook signature docs](https://docs.stripe.com/webhooks/signature) + [Next.js App Router guide](https://kitson-broadhurst.medium.com/next-js-app-router-stripe-webhook-signature-verification-ea9d59f3593f).

### Creating PaymentIntent on the server
```typescript
// src/app/api/checkout/payment-intent/route.ts
import { stripe } from '@/lib/stripe/client'
import { stageCart } from '@/lib/checkout/stage-cart'
import { computeTotals } from '@/lib/checkout/totals'

export async function POST(req: Request) {
  const input = await req.json()        // validate with Zod schema
  const parsed = checkoutInputSchema.parse(input)

  const totals = await computeTotals(parsed)        // server-canonical math
  const snapshotId = await stageCart(parsed, totals) // returns cart_snapshot.id

  const pi = await stripe.paymentIntents.create({
    amount: totals.total,                            // CLP integer
    currency: 'clp',                                 // zero-decimal
    automatic_payment_methods: { enabled: true },
    metadata: { cart_snapshot_id: snapshotId },
    receipt_email: parsed.email,
  }, {
    idempotencyKey: `pi:${snapshotId}`,
  })

  return Response.json({ clientSecret: pi.client_secret, totals })
}
```

### Creating per-artisan transfers in webhook
```typescript
// inside handlePaymentSucceeded
for (const group of artisanGroups) {
  const transfer = await stripe.transfers.create({
    amount: group.artisanNet,                  // CLP integer
    currency: 'clp',
    destination: group.stripeAccountId,        // requires Path A or C-enabled
    source_transaction: charge.id,             // binds to settled charge
    transfer_group: order.id,
    metadata: { order_id: order.id, artisan_id: group.artisanId },
  }, {
    idempotencyKey: `tr:${order.id}:${group.artisanId}`,
  })
  await supabase.from('payment').update({ stripe_transfer_id: transfer.id }).eq('order_id', order.id)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `req.json()` then verify signature manually (Pages Router era) | `req.text()` + `stripe.webhooks.constructEvent` | App Router (Next.js 13+) | Required pattern; documented |
| Stripe Charges API (`stripe.charges.create`) | Payment Intents API with automatic payment methods | 2019, mandatory for SCA | All new code uses PI |
| `transfer_data.destination` for marketplaces | Separate Charges & Transfers for multi-vendor | Always for cart-with-N-sellers | Pattern locked |
| `legacy_payments` charge type | `payment_method_types: ['card']` or `automatic_payment_methods` | 2022+ | Use automatic |

**Deprecated/outdated:**
- Stripe SDK v10 and earlier (project uses 17.1.0, fine; latest is 22.1.1 but no need to upgrade for Phase 3).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Stripe Connect Separate Charges & Transfers is regionally limited to AU/CA/EU/JP/MY/NZ/SG/US | Stripe Connect Chile Feasibility | Wrong → D-07 is fully implementable as-is; Path B/C unnecessary. Right → planning must pick a path. **Verify with Stripe support before locking plan.** |
| A2 | Chilexpress quote endpoint shape (`/rating/api/v1.0/rates`) is current | Couriers — Chilexpress | Wrong → URL/auth wrong, quote returns errors. Wave 0 sandbox test mitigates. |
| A3 | Starken quote endpoint `gateway.starken.cl/quote/cotizador` is current and uses Basic auth | Couriers — Starken | Wrong → auth fails. Wave 0 sandbox test mitigates. **Confidence LOW** — Starken docs sparse. |
| A4 | A new `cart_snapshot` table (or equivalent staging) is acceptable | Pattern 2 | Wrong → must use Redis or stuff data in PI metadata (size limits). Planner decides. |
| A5 | Stripe accepts `currency: 'clp'` for PaymentIntents at amounts in zero-decimal integer (no multiplication by 100) | Code Examples | Wrong → amounts are 100x off. Verify with Stripe's currency docs: CLP **is** zero-decimal at Stripe per supported currencies list, but **double-check** in test mode before going live. |
| A6 | `webhook_event` table from migration 007 is the right idempotency surface for Phase 3 | Pattern 5 | Wrong → need separate table or different PK strategy. Schema review confirms `id TEXT PRIMARY KEY` matches Stripe `event.id` shape. **Confidence HIGH.** |
| A7 | Coupon `discount_value` of type `INTEGER` for percentage means literal % (e.g., 10 = 10%) | Coupons | Wrong → discounts off by 100x. Schema comment: "porcentaje entero si percentage" confirms intent. **Confidence HIGH.** |
| A8 | env example claim "NO Stripe Connect" reflects an outdated/proposed architecture, not a locked decision overriding D-07 | Critical Flag | Wrong → CONTEXT.md D-07 is wrong, not the env file. Discuss-phase already decided D-07; assume D-07 wins until contradicted by user. |

## Open Questions

1. **Stripe Connect Chile — verified availability of Separate Charges & Transfers?**
   - What we know: docs list a fixed region set excluding CL; preview features change frequently; STATE.md flags this.
   - What's unclear: whether the platform account country can be CL, or whether US LLC is required; whether artisans can onboard as Express in CL.
   - Recommendation: Wave 0 = open Stripe support ticket OR check live dashboard with current account; pick Path A/B/C from Critical Flag section.

2. **Shipping cost destination per D-09 — go to artisan or to platform?**
   - What we know: D-09 says shipping doesn't enter commission base; "or to platform if platform charged shipping on artisan's behalf" is left open.
   - Recommendation: shipping cost flows to artisan (added to their net transfer) — simpler accounting, matches "envío directo del artesano" core value. Confirm with user during planning.

3. **Cart staging — DB table vs ephemeral store?**
   - What we know: PI metadata is too small for full cart.
   - Recommendation: new migration `015_cart_snapshot.sql` with `id UUID PK, payload JSONB, expires_at TIMESTAMPTZ`. Cleanup cron deferred. Alternative: Vercel KV / Redis. DB table is simpler and avoids new infra dependency.

4. **Coupon admin minimum for QA (D-17)?**
   - Recommendation: ship a seed migration with 2-3 test coupons (`CRISOL10`, `BIENVENIDA`, expired one). Full admin CRUD in Phase 5.

5. **Failed payment UX — auto-recreate PI vs new checkout?**
   - Recommendation: Stripe Elements handles 3DS retry inline; for hard failures, redirect to checkout with error toast and same cart_snapshot still valid (until expiry).

6. **i18n strings completeness (en)?**
   - Recommendation: add `messages/en/checkout.json` with English keys (CLAUDE.md requires structure to exist; content can mirror es).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | yes | v22.17.0 | — |
| pnpm | Build | yes | 10.33.0 | — |
| Supabase CLI | Migrations | yes | 2.90.0 | — |
| `stripe` CLI (for `stripe listen` local webhook forwarding) | Local webhook dev | **NO** | — | Install via `brew install stripe/stripe-cli/stripe`; without it, webhook testing is harder but possible via deployed preview + ngrok |
| Stripe test account | All Stripe code | unknown | — | Required; cannot test without it |
| Chilexpress sandbox subscription | Couriers | unknown | — | Required for COMR-05 sandbox testing; flat-rate fallback works without |
| Starken sandbox credentials | Couriers | unknown | — | Same — fallback covers UX, but live integration needs creds |
| Resend account + verified domain | Order email | unknown (Phase 1 dependency) | — | Mock in tests; require for prod |

**Missing dependencies with no fallback:**
- Stripe test account credentials (must be provisioned and added to `.env.local`).
- Chilexpress / Starken sandbox keys (STATE.md flagged as risk).

**Missing dependencies with fallback:**
- Stripe CLI for local webhook testing — falls back to deployed preview + manual trigger; recommend installing.

**Action required from user before plan execution:**
- Provision Stripe test account, get publishable + secret keys.
- Apply for Chilexpress and Starken sandbox access (lead time can be days/weeks).
- Decide Path A/B/C for Stripe Connect.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.2 (unit/integration) + Playwright 1.48 (E2E) |
| Config file | `vitest.config.ts`, `playwright.config.ts` |
| Quick run command | `pnpm test` (vitest run) |
| Full suite command | `pnpm test && pnpm test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMR-01 | Cart persists across reload | E2E | `pnpm test:e2e tests/e2e/cart-persist.spec.ts` | Wave 0 |
| COMR-02 | Multi-artisan cart + correct totals per artisan | unit + E2E | `pnpm test src/lib/checkout/totals.test.ts` + spec | Wave 0 |
| COMR-03 | No-returns disclaimer + checkbox blocks pay button | E2E | `pnpm test:e2e tests/e2e/checkout-disclaimers.spec.ts` | Wave 0 |
| COMR-04 | Address triggers courier quote shown in UI | E2E (mocked courier) | `pnpm test:e2e tests/e2e/checkout-shipping.spec.ts` | Wave 0 |
| COMR-05 | Quote timeout falls back to flat rate | unit (timeout mocked) | `pnpm test src/lib/couriers/index.test.ts` | Wave 0 |
| COMR-06 | Stripe split: PI created, transfer issued, amounts correct | integration (Stripe test mode) | `pnpm test src/lib/orders/create-from-payment.test.ts` | Wave 0 |
| COMR-07 | Webhook signature verified; idempotency by event.id | unit | `pnpm test src/app/api/webhooks/stripe/route.test.ts` | Wave 0 |
| COMR-08 | Order created with snapshot title/price; immutable | integration | included with COMR-06 test | Wave 0 |
| COMR-09 | Intl tax disclaimer visible at checkout | E2E | bundled with COMR-03 | Wave 0 |
| COUP-01 | Coupon row insertable with all fields | unit (DB) | seed verification | Wave 0 |
| COUP-02 | Apply code in checkout updates totals | E2E | `pnpm test:e2e tests/e2e/checkout-coupon.spec.ts` | Wave 0 |
| COUP-03 | Validation rejects expired/maxed/inactive | unit | `pnpm test src/lib/checkout/coupon.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test` (fast unit suite)
- **Per wave merge:** `pnpm test && pnpm lint`
- **Phase gate:** `pnpm test:e2e` full E2E suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/checkout/totals.test.ts` — totals math
- [ ] `src/lib/checkout/coupon.test.ts` — coupon validation
- [ ] `src/lib/couriers/index.test.ts` — quote-with-timeout
- [ ] `src/lib/orders/create-from-payment.test.ts` — webhook order creation transaction (with Supabase test client)
- [ ] `src/app/api/webhooks/stripe/route.test.ts` — signature + idempotency
- [ ] `tests/e2e/cart-persist.spec.ts`
- [ ] `tests/e2e/checkout-shipping.spec.ts`
- [ ] `tests/e2e/checkout-coupon.spec.ts`
- [ ] `tests/e2e/checkout-disclaimers.spec.ts`
- [ ] `tests/e2e/checkout-payment.spec.ts` — uses Stripe test card `4242 4242 4242 4242`
- [ ] Stripe CLI install for local webhook testing (optional but recommended)
- [ ] Test factories: `src/test/factories/cart.ts`, `order.ts`, `coupon.ts`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (existing); guest flow uses signed magic-link token for order access |
| V3 Session Management | yes | `@supabase/ssr` cookie sessions (existing); no new session surface |
| V4 Access Control | yes | RLS on `order`, `order_item`, `payment`, `shipment` (Phase 1 deliverable — verify policies allow `buyer_id = auth.uid()` reads and service-role writes from webhook) |
| V5 Input Validation | yes | Zod schemas at every API boundary: `/api/checkout/payment-intent`, `/api/couriers/quote`, `/api/webhooks/stripe`, coupon server action |
| V6 Cryptography | yes | Stripe webhook signature verification (HMAC); guest order token — recommend `jose` JWT or HMAC token signed with `REVALIDATE_SECRET` or new `GUEST_TOKEN_SECRET` (don't reuse) |
| V7 Error Handling & Logging | yes | Webhook failures logged with event.id; never echo Stripe secrets; never log full PI body in plaintext (PII / card metadata) |
| V8 Data Protection | yes | Shipping addresses are PII — RLS must restrict reads to buyer + their artisan(s) + admin. No PII in client-side localStorage cart. |
| V13 API & Web Service | yes | Stripe webhook endpoint must be unauthenticated by app (signature is the auth); reject if signature missing |

### Known Threat Patterns for {Next.js + Supabase + Stripe stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered cart prices submitted to PaymentIntent endpoint | Tampering | Server recomputes all totals from canonical product/variant table; ignore client-supplied prices |
| Replay of webhook event | Spoofing/Repudiation | Signature verification + `webhook_event.id` PK uniqueness |
| SQL injection via address fields | Tampering | Parameterized queries via Supabase JS client (no raw SQL strings with user input) |
| XSS via product title in order summary | Tampering | React auto-escapes; never use `dangerouslySetInnerHTML` for user content |
| CSRF on coupon apply / cart actions | Spoofing | Server actions use built-in CSRF tokens; same-origin policy on API routes |
| Coupon brute-force | Information Disclosure | Rate-limit `/api/checkout/coupon` (e.g., Vercel rate limit or in-memory bucket); generic error messages ("invalid or expired") |
| Stripe key leak | Information Disclosure | `STRIPE_SECRET_KEY` server-only; never imported into client component; ESLint/grep audit |
| Negative quantity / amounts | Tampering | Zod `.int().positive()` on qty; CLP type rejects negatives |
| IDOR on `/pedido/{id}` | Access Control | RLS enforces buyer_id match; for guests, signed token bound to order_id |
| Webhook DoS via spam events | DoS | Rate limit webhook endpoint at edge; idempotency table prevents duplicate processing cost |
| Coupon race condition | Tampering | Conditional UPDATE with `WHERE uses_count < uses_limit` (see Pitfall 6) |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/03-commerce/03-CONTEXT.md` — locked decisions
- `.planning/REQUIREMENTS.md` — COMR-01..09, COUP-01..03
- `supabase/migrations/003_config.sql`, `005_commerce.sql`, `007_webhook_idempotency.sql`, `008_state_machines.sql` — schema ground truth
- `src/lib/utils/commission.ts`, `src/lib/utils/clp.ts` — already-tested money helpers
- `package.json` — pinned versions
- `crisol.env.example` — env contract (and source of CRITICAL FLAG)
- [Stripe Webhooks Signature](https://docs.stripe.com/webhooks/signature)
- [Stripe Connect Separate Charges & Transfers](https://docs.stripe.com/connect/separate-charges-and-transfers)
- [Stripe Connect Integration Recommendations](https://docs.stripe.com/connect/integration-recommendations)
- [Stripe Metadata](https://docs.stripe.com/metadata)
- [Stripe Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)

### Secondary (MEDIUM confidence)
- [Next.js App Router + Stripe Webhook (Kitson Broadhurst, Medium)](https://kitson-broadhurst.medium.com/next-js-app-router-stripe-webhook-signature-verification-ea9d59f3593f)
- [Stripe Webhook Security: Signature, Idempotency, Local Testing (dev.to)](https://dev.to/whoffagents/stripe-webhook-security-signature-verification-idempotency-and-local-testing-1lk3)
- [Cobbleweb — Choosing the right Stripe Connect charge type](https://www.cobbleweb.co.uk/choose-the-right-stripe-connect-charge-type-for-your-marketplace-business-model/)
- [Chilexpress Developers Portal](https://developers.wschilexpress.com/)
- [Starken Integraciones](https://www.starken.cl/integraciones)
- [Zustand persist middleware in Next.js (dev.to)](https://dev.to/abdulsamad/how-to-use-zustands-persist-middleware-in-nextjs-4lb5)
- [pmndrs/zustand persist + SSR discussion #1382](https://github.com/pmndrs/zustand/discussions/1382)

### Tertiary (LOW confidence — mark for verification)
- Specific Chilexpress endpoint paths (URL structure changes; verify in portal)
- Starken endpoint shape and auth mechanism (sparse public docs)
- Stripe Connect "Separate Charges & Transfers" preview availability for CL platform accounts (must confirm with Stripe support)

## Project Constraints (from CLAUDE.md)

- All API/server-action input validated with Zod (mandatory, not optional).
- Webhooks must verify signature AND enforce idempotency by `event.id`.
- Commission via `lib/utils/commission.ts` only — never hardcode percentage.
- CLP is zero-decimal integer; use existing `clp.ts` helpers; never floating-point.
- RLS active on every table; `service_role` key only server-side.
- Order state transitions strict: do not skip states (use `transition_order_status` RPC).
- Files: kebab-case `.ts/.tsx`, hooks `use-*.ts`. TS types `PascalCase`, vars `camelCase`, constants `UPPER_SNAKE_CASE`. DB `snake_case`.
- Import alias `@/` → `src/`.
- Locale `es` mandatory; `en` structure must exist.
- Migrations forward-only and numbered; `database.types.ts` regenerated, never hand-edited.
- Branching: `feature/*` from `develop`; never push to protected.
- Every feature requires Playwright E2E covering happy path + at least one error case.
- Test data via factories in `src/test/factories/` — no hardcoded data.
- Brevity in chat responses (per project instructions); not enforced for files.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libs already pinned in `package.json`.
- Architecture (cart, checkout, webhook): HIGH — established Stripe + Next.js patterns.
- **Stripe Connect Chile feasibility: MEDIUM** — needs Stripe support confirmation; three resolution paths documented.
- Couriers (Chilexpress / Starken): MEDIUM — official portals exist but exact endpoints/auth need Wave 0 sandbox verification.
- Pitfalls: HIGH — all pitfalls cited from documented sources or pattern best practices.

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (30 days; Stripe API changes monthly, courier APIs less so).

---
*Phase: 03-commerce*
*Researched: 2026-05-09*
