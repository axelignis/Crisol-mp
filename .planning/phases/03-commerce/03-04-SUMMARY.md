---
phase: 03-commerce
plan: 04
subsystem: checkout
tags: [checkout, stripe, coupons, ui, tdd, single-account]
requires: ["03-01", "03-02", "03-03"]
provides:
  - "computeTotals (server-canonical, calculateSplit per artisan, D-14/D-15)"
  - "validateCoupon preview + reserveCoupon atomic (RPC reserve_coupon)"
  - "buildPayoutLedger (D-15 plataforma absorbe descuento, artisan_net intacto)"
  - "stageCart (cart_snapshot insert para PI metadata reference)"
  - "POST /api/checkout/coupon (preview)"
  - "POST /api/checkout/payment-intent (stage + reserve + PI create)"
  - "Stripe client lazy (Proxy) — build no requiere STRIPE_SECRET_KEY"
  - "UI single-page (D-18): contact/address/shipping/coupon/disclaimers/payment + sticky OrderSummary"
  - "Confirmacion page interim (Plan 06 entrega final)"
  - "Migration 020 reserve_coupon RPC (UPDATE … RETURNING)"
affects:
  - "messages/{es,en}.json (merge checkout/order namespaces)"
  - "src/lib/stripe/client.ts (lazy Proxy)"
tech-stack:
  added: []
  patterns:
    - "Proxy lazy-init para evitar throws at module-load time"
    - "vi.hoisted para mocks que comparten estado entre vi.mock factories"
    - "Conditional UPDATE … RETURNING para reservas atómicas (race-safe)"
    - "Server-canonical pricing: cliente NUNCA calcula totales"
key-files:
  created:
    - "src/lib/checkout/totals.ts"
    - "src/lib/checkout/totals.test.ts"
    - "src/lib/checkout/coupon.ts"
    - "src/lib/checkout/coupon.test.ts"
    - "src/lib/checkout/stage-cart.ts"
    - "src/lib/stripe/payout-ledger.ts"
    - "src/lib/stripe/payout-ledger.test.ts"
    - "src/app/api/checkout/coupon/route.ts"
    - "src/app/api/checkout/payment-intent/route.ts"
    - "src/app/api/checkout/payment-intent/route.test.ts"
    - "src/components/checkout/checkout-contact.tsx"
    - "src/components/checkout/checkout-address.tsx"
    - "src/components/checkout/checkout-shipping.tsx"
    - "src/components/checkout/checkout-coupon.tsx"
    - "src/components/checkout/checkout-disclaimers.tsx"
    - "supabase/migrations/020_reserve_coupon_rpc.sql"
  modified:
    - "src/components/checkout/checkout-form.tsx"
    - "src/components/checkout/order-summary.tsx"
    - "src/components/checkout/payment-stripe.tsx"
    - "src/app/[locale]/checkout/page.tsx"
    - "src/app/[locale]/checkout/confirmacion/page.tsx"
    - "src/lib/stripe/client.ts"
    - "messages/es.json"
    - "messages/en.json"
decisions:
  - "RPC reserve_coupon (migration 020) en lugar de UPDATE inline — encapsula la atomic reservation y deja el endpoint testeable con mock de supabase.rpc"
  - "Stripe client convertido a Proxy lazy — el patrón heredado throwaba en module-load, rompiendo `next build` (collect page data) sin STRIPE_SECRET_KEY. La throw se mantiene pero diferida al primer uso real"
  - "i18n merge runtime de messages/{locale}/checkout.json a messages/{locale}.json — el i18n loader (request.ts) lee solo el archivo monolítico; sin merge los keys checkout/order quedaban inaccesibles para useTranslations"
  - "Stage cart payload incluye `couponId` y `ledger` precomputado — el webhook (Plan 05) los consume sin re-incrementar uses_count y sin recalcular ledger"
  - "Discount distribuido proporcional al subtotal por artesano (no flat ni first-artisan) — preserva fairness cuando hay multi-artesano y la plataforma absorbe diferencia si excede comisión"
  - "UI con state nativo (useState) en lugar de react-hook-form — la complejidad del form no lo amerita y mantiene la superficie de test razonable; se puede migrar a RHF en Plan 06+ si las validaciones crecen"
metrics:
  completed: "2026-05-09"
  tasks: 2
  commits: 3
requirements: [COMR-02, COMR-03, COMR-04, COMR-08, COMR-09, COUP-02, COUP-03]
---

# Phase 3 Plan 04: Checkout Single-Page Summary

Checkout completo end-to-end con TDD intensivo: 22 tests de lógica server (totals/coupon/payout-ledger) + 8 tests de route + UI single-page (D-18) con secciones contact/address/shipping/coupon/disclaimers/payment + sticky OrderSummary. Single-account model (D-SPLIT) sin Stripe Connect. Race condition de cupón resuelta vía RPC `reserve_coupon` (UPDATE condicional atómico, D-15 fix). 30/30 tests verdes, build OK, typecheck OK.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 RED | Tests fallidos para totals + coupon + payout-ledger | a0a491f | totals.test.ts, coupon.test.ts, payout-ledger.test.ts (+ stubs) |
| 1 GREEN | Implementación lógica server + RPC migration | 8af5c4d | totals.ts, coupon.ts, payout-ledger.ts, stage-cart.ts, 020_reserve_coupon_rpc.sql |
| 2 | API routes + UI checkout single-page + Stripe lazy fix | cf306c3 | api/checkout/{coupon,payment-intent}/route.ts, route.test.ts, components/checkout/* (8), pages, stripe/client.ts (Proxy), messages |

## What Was Built

### Lógica server (Task 1 — TDD)

**`src/lib/checkout/totals.ts` — `computeTotals(input)`:**
- Single source of truth de totales. Cliente NUNCA recalcula.
- Itera items, agrupa por artesano, lookup canonical (`basePrice + priceModifier`).
- Aplica `calculateSplit(subtotal, commissionPct)` per artesano (no hardcode).
- `discount = min(reservedDiscount, subtotal)` (cap, D-14).
- `total = subtotal - discount + shippingTotal`.
- D-15: artisan_net = `(subtotal - commission) + shipping` — descuento NUNCA reduce artisan_net.
- Throws si: variant missing en lookup, shipment missing per artesano.
- 7 tests (single artisan, multi-artesano, priceModifier, discount, cap, missing variant, missing shipment).

**`src/lib/checkout/coupon.ts` — `validateCoupon` + `reserveCoupon`:**
- `validateCoupon` (read-only): SELECT vía `from('coupon').eq('code')`. Valida is_active / expires_at / uses_limit / min_order. Calcula discount (percentage floor o fixed cap).
- `reserveCoupon` (atomic): RPC `reserve_coupon(p_code, p_subtotal)` — encapsula UPDATE condicional con RETURNING. Retorna 0 filas si race/limit/inactive/expired/min_order — endpoint mapea a 409 `coupon_invalid`.
- 10 tests (not_found, expired, limit_reached, min_order, percentage, fixed cap, inactive + 3 reserveCoupon).

**`src/lib/stripe/payout-ledger.ts` — `buildPayoutLedger(input)`:**
- D-SPLIT, D-07 single-account, D-15 platform absorbs discount.
- Distribuye `discount` proporcional al subtotal por artesano (con ajuste de redondeo en el último para conservar exact sum).
- Retorna `{artisanId, gross, commissionGross, discountAbsorbedByCommission, shippingClp, netToArtisan}`.
- INVARIANTE: `sum(netToArtisan) + platformNet = subtotal - discount + shippingTotal` (verificado por property test).
- 5 tests incluyendo discount > commission (plataforma queda negativa, artisans intactos).

**`src/lib/checkout/stage-cart.ts` — `stageCart(supabase, input, totals)`:**
- Insert en `cart_snapshot` con payload + totals + email + buyer_id.
- Retorna `id` para usar como `cart_snapshot_id` en `PaymentIntent.metadata`.
- TTL 30 min (default de la migración 016).

**Migration 020 — `reserve_coupon` RPC:**
```sql
UPDATE coupon
   SET uses_count = uses_count + 1
 WHERE code = upper(trim(p_code))
   AND is_active = true
   AND (expires_at IS NULL OR expires_at > now())
   AND (uses_limit IS NULL OR uses_count < uses_limit)
   AND (min_order  IS NULL OR min_order  <= p_subtotal)
 RETURNING id, discount_type::TEXT, discount_value;
```
SQL function (no PL/pgSQL) — más simple, atómica, sin condition de carrera.

### API Routes (Task 2)

**`POST /api/checkout/coupon`:** Zod `{code, subtotal}` → `validateCoupon` (preview, no muta) → `{valid, discount, discountType}` o `{valid:false, reason}`. Mensaje genérico para reasons (T-03-13 brute force).

**`POST /api/checkout/payment-intent`:** Pipeline 11 pasos:
1. Parse Zod (`checkoutSchema` con `countryCode: z.literal('CL')` y `acceptedDisclaimers: z.literal(true)`).
2. Si `buyer_id` presente: `getUser()` + assert `email_confirmed_at` (D-05, T-03-11) → 403 si no.
3. SELECT `product_variant` join `product` por items. Filtra `status='published'` y `stock>=qty`. Si insuficiente → 409 `stock_insufficient` con detalle (T-03-14).
4. SELECT `commission_config` más reciente (`effective_from <= now() ORDER BY effective_from DESC LIMIT 1`).
5. Verifica que cada artesano tenga 1 shipment → 400 `shipment_missing`.
6. Calcula `preSubtotal` para `reserveCoupon`.
7. Si `couponCode`: `reserveCoupon` (atomic) → 409 `coupon_invalid` si race/limit/etc.
8. `computeTotals({reservedDiscount, ...})`.
9. `buildPayoutLedger(...)` precomputado (consumido por webhook Plan 05 sin recalcular).
10. `stageCart(supabase, input, {...totals, couponId, ledger})` → snapshotId.
11. `stripe.paymentIntents.create({amount: total, currency:'clp', metadata:{cart_snapshot_id, buyer_id}, receipt_email}, {idempotencyKey: 'pi:'+snapshotId})`.

Response: `{clientSecret, snapshotId, totals}` — totals **NO incluye `commission`** (T-03-12).

**8 route tests:** happy path (subtotal/total/idempotencyKey/commission-not-exposed), country!=CL (400), disclaimers!=true (400), stock_insufficient (409 + stripe NOT called), shipment_missing (400), coupon race (409), coupon valid (200 con discount aplicado), invalid_json (400).

### UI Checkout Single-Page (D-18)

Layout 2-col desktop (form izquierda, summary sticky derecha), stack mobile.

**Componentes:**
- `checkout-contact.tsx`: email input. Si user logged + verified, prefill + read-only.
- `checkout-address.tsx`: form con fullName/line1/line2/city/region/phone. Country fixed CL (display-only).
- `checkout-shipping.tsx`: lista de selecciones per-artesano. Botón "Cotizar envío" fetcha `/api/couriers/quote`. Fallback flat_rate si endpoint falla. Render `timeoutFallback` si `source='flat_rate'`.
- `checkout-coupon.tsx`: input + apply button → POST `/api/checkout/coupon`. Mensaje claro de error (mapeado de reason). Botón quitar.
- `checkout-disclaimers.tsx`: ul con noReturns + intlTax (D-19, COMR-03/09) + checkbox `data-testid="checkout-disclaimers-accept"`.
- `order-summary.tsx`: sticky right (`top-24 h-fit`). Subtotal / discount (si >0) / shipping / total. **Sin commission** (T-03-12).
- `payment-stripe.tsx`: 2 estados — sin `clientSecret` muestra botón "Pagar" que invoca `onConfirm` (`POST /api/checkout/payment-intent`). Con clientSecret monta `<Elements options={{clientSecret, locale:'es'}}><PaymentElement/></Elements>` + botón que llama `stripe.confirmPayment({elements, confirmParams:{return_url}})`.
- `checkout-form.tsx`: orchestrator. Lee `useCart()`. Si `count===0` redirect a `/{locale}/carrito`. Calcula `formValid`, `payable = formValid && shipments cubren && accepted`. Botón Pagar gated por `payable`.

**Pages:**
- `/[locale]/checkout/page.tsx`: server component. `getUser()` → si email confirmed pasa `initialEmail`+`buyerId` al form. `metadata.robots.index=false`. `dynamic='force-dynamic'`.
- `/[locale]/checkout/confirmacion/page.tsx`: interim que muestra `snapshot`, `payment_intent`, `redirect_status` desde search params (return_url de Stripe). Plan 06 entregará `/pedido/{id}` final.

### Stripe lazy Proxy

`src/lib/stripe/client.ts` reescrito con Proxy: la throw por `STRIPE_SECRET_KEY` ahora se difiere al primer acceso real al SDK. Antes throwaba en module-load y rompía `next build` (collect page data). Patrón:
```ts
let _instance: Stripe | null = null
function getInstance() { /* lazy + throw si missing */ }
export const stripe = new Proxy({} as Stripe, { get(_t, p) { ... } })
```

### i18n

Merge runtime de `messages/{es,en}/checkout.json` (creado por Plan 01) en `messages/{es,en}.json` (que es lo que el i18n loader lee). Namespaces inyectados: `checkout` (con sub-keys contact/address/shipping/coupon/disclaimers/payment/summary), `order`, `checkoutErrors` (renombrado para evitar colisión con namespace `errors` existente).

## Verification Results

- `pnpm exec vitest run` — **104/104 tests verdes** globales:
  - 22 nuevos en este plan (totals 7 + coupon 10 + payout-ledger 5)
  - 8 route tests payment-intent
  - resto (couriers, cart store, commission utility, etc.) intactos
- `pnpm exec tsc --noEmit` → exit 0.
- `SKIP_ENV_VALIDATION=1 pnpm exec next build` → ✓ Compiled successfully. Rutas registradas: `/api/checkout/coupon`, `/api/checkout/payment-intent`, `/[locale]/checkout`, `/[locale]/checkout/confirmacion`.

Tests específicos de este plan:
```
✓ src/lib/checkout/totals.test.ts (7 tests)
✓ src/lib/checkout/coupon.test.ts (10 tests)
✓ src/lib/stripe/payout-ledger.test.ts (5 tests)
✓ src/app/api/checkout/payment-intent/route.test.ts (8 tests)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stripe client throw at module-load rompe `next build`**
- **Found during:** Task 2 — primer `next build` con la nueva ruta.
- **Issue:** `src/lib/stripe/client.ts` (heredado del Plan 01) hace `throw` si `STRIPE_SECRET_KEY` no está al cargar el módulo. Next 14 collect-page-data ejecuta el módulo sin env vars y falla. Bloquea CI/dev sin secret.
- **Fix:** Reescribir con `Proxy` lazy — getInstance() difiere la throw al primer uso real del SDK. La validación se mantiene.
- **Files modified:** `src/lib/stripe/client.ts`.
- **Commit:** cf306c3.

**2. [Rule 3 - Blocking] vi.mock factory + variable top-level (TDZ)**
- **Found during:** Task 2 — primer run de `route.test.ts`.
- **Issue:** Vitest hoistea `vi.mock` factories al top del módulo. Referenciar `stripeCreateMock` declarado al toplevel falla con `Cannot access 'stripeCreateMock' before initialization`.
- **Fix:** Usar `vi.hoisted(() => ({...}))` para inicializar mocks compartidos.
- **Files modified:** `src/app/api/checkout/payment-intent/route.test.ts`.
- **Commit:** cf306c3.

**3. [Rule 2 - Missing critical functionality] i18n merge a archivo monolítico**
- **Found during:** Task 2 — primer render del UI.
- **Issue:** Plan 01 entregó `messages/{es,en}/checkout.json` (subdir), pero `i18n/request.ts` lee solo `messages/{locale}.json`. Sin merge `useTranslations('checkout.disclaimers')` retornaría keys faltantes.
- **Fix:** Script de merge inline (node) que copia checkout/order del subdir al archivo monolítico, renombrando `errors → checkoutErrors` para no colisionar con el namespace existente.
- **Files modified:** `messages/es.json`, `messages/en.json`.
- **Commit:** cf306c3.

**4. [Rule 1 - Bug] `discount_type::TEXT` en RPC**
- **Found during:** Task 1 — diseño de la migración.
- **Issue:** `coupon.discount_type` es TEXT con CHECK pero PostgREST puede inferir el tipo del enum CHECK como composite si el RPC lo retorna sin cast. Cast explícito a TEXT garantiza compatibilidad con el cliente JS.
- **Fix:** `RETURNING id, discount_type::TEXT, discount_value` en la SQL function.
- **Files modified:** `supabase/migrations/020_reserve_coupon_rpc.sql`.
- **Commit:** 8af5c4d.

### Auth Gates / Manual Steps

**Migración 020 NO aplicada al supabase local** — el worktree no tiene supabase corriendo (checkpoint `supabase start` lo correrá el dev local). La migración es forward-only y se aplica con `supabase migration up` en cualquier ambiente. Las llamadas a `reserveCoupon` desde el endpoint requieren la RPC presente; sin ella el endpoint retorna 409 `coupon_invalid` (graceful degradation — el carrito sin cupón sigue funcionando).

**Verificación manual** (cuando supabase local esté arriba):
```bash
supabase migration up
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "SELECT id, discount_type, discount_value FROM reserve_coupon('CRISOL10', 100000);"
# Esperado: 1 fila con id, 'percentage', 10
```

## Deferred Issues

- **`pnpm test:e2e`** no ejecutado — el worktree no levanta dev server ni Playwright. El happy path E2E del checkout es responsabilidad de Plan 07 (smoke E2E) según el roadmap de Phase 3.
- **`pnpm lint`** — falla por conflicto pre-existente del plugin `@next/next` heredado del worktree padre (documentado en SUMMARY de Plans 01 y 02). Out of scope.
- **Migration 020** sin aplicar localmente (sin supabase corriendo). Forward-only; aplicará en CI/staging/prod sin issues.
- **react-hook-form integration** diferido — el form actual usa `useState` nativo. Suficiente para validaciones del plan; migración a RHF si Plan 06+ agrega validaciones complejas.
- **Cleanup job para PIs abandonados** (uses_count inflado si buyer abandona) — explícitamente diferido a Phase 5 según el plan y el threat model.
- **Rate limiting de `/api/checkout/coupon`** (T-03-13 brute force) — diferido a Phase 5; el endpoint ya retorna mensaje genérico para reasons.

## Threat Surface Coverage

Mitigaciones aplicadas según `<threat_model>` del plan:

- **T-03-10 (Tampering — client-submitted total/discount):** server recomputa todo desde `productLookup` canónico (variantes filtradas a `status='published'`). Cliente sólo manda `{variantId, qty}` y `couponCode`; precios y discount son ignorados.
- **T-03-11 (Spoofing — buyer sin email_confirmed):** `getUser()` + check `email_confirmed_at` → 403 `email_not_confirmed` si falla. Tambien valida `userRes.user.id === input.buyer_id` para evitar buyer_id spoofed.
- **T-03-12 (Information Disclosure — commission al buyer):** route response **explícitamente NO incluye** `commission` en `totals` (test `expect(json.totals).not.toHaveProperty('commission')`). `OrderSummary` no renderiza commission. Solo `subtotal/discount/shipping/total + perArtisan{subtotal, shipping}`.
- **T-03-13 (Tampering — coupon brute force):** mensaje genérico de reason en `/api/checkout/coupon` (no expone existencia). Rate limit diferido (anotado).
- **T-03-14 (Tampering — variant no publicado / sold):** lookup query filtra `status='published'` Y `stock >= qty`. Si insuficiente → 409 con detalle (sin exponer otros variants).
- **T-03-15 (Repudiation — disclaimer click sin record):** `acceptedDisclaimers: z.literal(true)` en schema. `cart_snapshot.payload` guarda el flag para auditoría futura.
- **T-03-23 (Tampering race — coupon `uses_count > uses_limit`):** `reserveCoupon` ejecuta UPDATE condicional atómico vía RPC `reserve_coupon` ANTES de crear el PI. El webhook (Plan 05) NO re-incrementa, solo asocia `coupon_id` al order. Cleanup job de PIs abandonados diferido a Phase 5.

No se introducen nuevas superficies de ataque no previstas.

## Self-Check: PASSED

Created files (all FOUND):
- src/lib/checkout/totals.ts
- src/lib/checkout/totals.test.ts
- src/lib/checkout/coupon.ts
- src/lib/checkout/coupon.test.ts
- src/lib/checkout/stage-cart.ts
- src/lib/stripe/payout-ledger.ts
- src/lib/stripe/payout-ledger.test.ts
- src/app/api/checkout/coupon/route.ts
- src/app/api/checkout/payment-intent/route.ts
- src/app/api/checkout/payment-intent/route.test.ts
- src/components/checkout/checkout-contact.tsx
- src/components/checkout/checkout-address.tsx
- src/components/checkout/checkout-shipping.tsx
- src/components/checkout/checkout-coupon.tsx
- src/components/checkout/checkout-disclaimers.tsx
- supabase/migrations/020_reserve_coupon_rpc.sql

Modified files (all FOUND):
- src/components/checkout/checkout-form.tsx
- src/components/checkout/order-summary.tsx
- src/components/checkout/payment-stripe.tsx
- src/app/[locale]/checkout/page.tsx
- src/app/[locale]/checkout/confirmacion/page.tsx
- src/lib/stripe/client.ts
- messages/es.json
- messages/en.json

Commits (all FOUND in git log):
- a0a491f — test(03-04): RED — failing tests para totals + coupon + payout-ledger
- 8af5c4d — feat(03-04): GREEN — totals + coupon + payout-ledger + stage-cart
- cf306c3 — feat(03-04): API routes coupon+payment-intent + UI checkout single-page

TDD Gate Compliance: RED (a0a491f) → GREEN (8af5c4d) → feat task 2 (cf306c3). Refactor no requirido (código GREEN ya limpio: tipos exportados, módulos cohesivos, sin duplicación).

Verifications:
- 104/104 unit tests passing (30 nuevos en este plan)
- `pnpm exec tsc --noEmit` → exit 0
- `next build` → ✓ Compiled successfully (cuando STRIPE_SECRET_KEY ausente — Proxy lazy)
