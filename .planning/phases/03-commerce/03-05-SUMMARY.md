---
phase: 03-commerce
plan: 05
subsystem: webhooks
tags: [stripe, webhooks, orders, tdd, single-account, idempotency, transactional]
requires: ["03-01", "03-04"]
provides:
  - "createOrderFromPayment (transactional order creation desde PI succeeded)"
  - "StockInsufficientError (clase tipada para flagging de reconciliacion)"
  - "revalidateStockWithLock (wrapper de RPC decrement_stock_atomic)"
  - "createServiceRoleClient (admin.ts, lazy server-only)"
  - "POST /api/webhooks/stripe (firma + idempotencia + dispatch)"
  - "totals.perItem (snapshot inmutable per-line para order_item, D-20)"
  - "stage-cart commissionPct passthrough (commission_pct_snapshot en order)"
affects:
  - "src/lib/checkout/totals.ts (perItem additive)"
  - "src/app/api/checkout/payment-intent/route.ts (commissionPct passthrough)"
tech-stack:
  added: []
  patterns:
    - "Webhook handler: req.text() -> constructEvent ANTES de cualquier req.json()"
    - "Idempotencia por PK insert + deteccion 23505 -> 200 duplicate"
    - "Errores post-firma siempre 200 (Stripe NO debe reintentar pagos succeeded)"
    - "Service role lazy con Proxy-like pattern (consistente con stripe/client.ts)"
    - "Mock de Supabase via factory chaineable + vi.hoisted para webhook tests"
key-files:
  created:
    - "src/lib/orders/create-from-payment.ts"
    - "src/lib/orders/create-from-payment.test.ts"
    - "src/lib/orders/stock-check.ts"
    - "src/lib/supabase/admin.ts"
    - "src/app/api/webhooks/stripe/route.test.ts"
  modified:
    - "src/app/api/webhooks/stripe/route.ts"
    - "src/lib/checkout/totals.ts"
    - "src/app/api/checkout/payment-intent/route.ts"
decisions:
  - "totals.perItem agregado al contrato (additive). El webhook lo necesita para crear order_item con snapshot_title+unit_price inmutables (D-20, COMR-08); reconstruirlo via re-query introduciria coupling y posible drift con productLookup canonico al momento del PI. Plan 04 sigue verde sin cambios al test (additive)."
  - "stage-cart persiste commissionPct en totals para que el webhook pueda poblar order.commission_pct_snapshot. Sin esto la auditoria perderia la tasa exacta vigente al pago."
  - "Errores de createOrderFromPayment se devuelven con HTTP 200 + flag webhook_event.error_message. Razon: Stripe reintenta en 5xx; el PI ya succeeded — un retry produciria doble procesamiento. Idempotencia por event.id mitiga el duplicado, pero el flag es necesario para reconciliacion manual (Phase 5)."
  - "buyer.id resuelto via lookup en buyer table por user_id antes del insert de order. order.buyer_id es FK a buyer(id), no a user(id). Sin lookup, los orders de buyers logged-in caerian al guest_email path."
  - "shipment.courier='flat_rate' mapeado a 'chilexpress' en el webhook — la tabla shipment.courier CHECK no incluye flat_rate (es solo un fallback de cotizacion). El courier real se actualiza cuando el artesano despacha."
  - "transition_order_status RPC (no UPDATE directo) garantiza que la transicion pending_payment -> paid pase por la state machine de migracion 008 con FOR UPDATE row lock. Cualquier transicion invalida o concurrente lanza P0001."
  - "createServiceRoleClient lazy + Proxy-style. SUPABASE_SERVICE_ROLE missing no rompe build (mismo patron que stripe/client.ts)."
metrics:
  completed: "2026-05-09"
  tasks: 2
  commits: 3
requirements: [COMR-06, COMR-07, COMR-08]
---

# Phase 3 Plan 05: Stripe Webhook → Transactional Order Creation Summary

Webhook `/api/webhooks/stripe` con verificacion HMAC + idempotencia por PK + creacion transaccional de orden (order/items/address/shipments/payment/payouts) desde `payment_intent.succeeded`. Single-account model (D-SPLIT) — cero referencias a Stripe Connect (`stripe.transfers.create`, `transfer_data`, `application_fee_amount`, `destination`). Coupon NO se re-incrementa (ya reservado en Plan 04). 19 tests nuevos (11 unit + 8 webhook), 123/123 globales verdes, `tsc --noEmit` limpio.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 RED | Tests fallidos para createOrderFromPayment + helpers | e0af4b3 | create-from-payment.test.ts, supabase/admin.ts, orders/stock-check.ts |
| 1 GREEN | Implementacion transaccional + perItem en totals | 801b56a | create-from-payment.ts, checkout/totals.ts, api/checkout/payment-intent/route.ts |
| 2 | Webhook handler + tests | 30a2ef4 | api/webhooks/stripe/route.ts, route.test.ts, create-from-payment.test.ts (typecheck) |

## What Was Built

### `src/lib/supabase/admin.ts`
`createServiceRoleClient()` lazy. Usa `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE`. Throws diferida hasta primer uso (no rompe `next build`). Singleton interno. Server-only por convencion + comentario explicito; ningun client component lo importa.

### `src/lib/orders/stock-check.ts`
`revalidateStockWithLock(supabase, items)` — wrapper de RPC `decrement_stock_atomic` (migracion 018, entregada por Plan 01). Retorna `{ok, rows, insufficient}`. La RPC hace `SELECT ... FOR UPDATE` per-variant + decrement atomico — mitigacion T-03-20 (oversell concurrente).

### `src/lib/orders/create-from-payment.ts`
`createOrderFromPayment({event, supabase}): Promise<{orderId}>`. Pipeline:
1. Extrae `pi.metadata.cart_snapshot_id` → throw `NO_SNAPSHOT_ID` si falta.
2. `cart_snapshot.select(*).eq('id', snapshotId).single()` → throw `SNAPSHOT_NOT_FOUND`.
3. RPC `decrement_stock_atomic({p_items})` → si alguna fila `ok=false` → throw `StockInsufficientError(insufficient[])`.
4. Si `snap.payload.buyer_id` (auth user id) presente → lookup `buyer.id` por `user_id`. Resuelve la FK correcta (`order.buyer_id` → `buyer(id)`, no `user(id)`).
5. Insert `order` con subtotal/shipping_cost/discount_amount/commission_amount/commission_pct_snapshot/total/coupon_id. Status default `pending_payment`.
6. Insert `order_item[]` desde `snap.totals.perItem` — `snapshot_title`, `unit_price`, `total_price`, `artisan_id` desnormalizado.
7. Insert `shipping_address` snapshot inmutable.
8. Insert `shipment[]` — uno por artesano. `courier='flat_rate'` se mapea a `'chilexpress'` (fallback de cotizacion no es valor valido en `shipment.courier` CHECK).
9. Insert `payment` con `method='stripe'`, `stripe_payment_intent_id=pi.id`, `stripe_transfer_id=null` (D-SPLIT), `status='paid'`, `paid_at=now()`. `artisan_net = sum(perArtisan.artisanNet)`.
10. Insert `artisan_payout[]` desde `snap.totals.ledger` — uno por artesano, `status='pending'`, `stripe_payout_id=null`. Notes contiene `order:${orderId}`.
11. RPC `transition_order_status(orderId, 'paid', null)` — usa state machine de migracion 008 con FOR UPDATE row lock.

`StockInsufficientError extends Error` exportado con campo `insufficient: Array<{variantId, available, requested}>` para que el caller (route.ts) decida flag vs propagacion.

### `src/lib/checkout/totals.ts` (additive)
Tipo `PerItemTotal` agregado y `Totals.perItem: PerItemTotal[]`. `computeTotals` ahora popula la lista durante la agrupacion por artesano. Los 7 tests existentes siguen verdes (el tipo es additive — no rompe shape esperado).

### `src/app/api/checkout/payment-intent/route.ts` (additive)
`stageCart(...)` recibe `commissionPct` ademas de `couponId` + `ledger`, para que el webhook pueda poblar `order.commission_pct_snapshot`.

### `src/app/api/webhooks/stripe/route.ts`
`POST` handler:
- `await req.text()` raw body → `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`. Falla → 400 `invalid_signature` (sin tocar DB).
- Insert PK en `webhook_event` con `id=event.id`, `source='stripe'`, `event_type`, `payload`. Codigo `23505` (duplicate PK) → 200 `{received:true, duplicate:true}` (no se llama createOrderFromPayment).
- Switch:
  - `payment_intent.succeeded` → `createOrderFromPayment(...)`. Exito → 200 `{received, orderId}`. Excepcion → flag `error_message` en `webhook_event` + 200 `{received, error:'order_creation_failed', details}`. Devolver 5xx haria que Stripe reintente; el PI ya succeeded → duplicado.
  - `payment_intent.payment_failed` → log unicamente, 200.
  - default → 200 `{received, ignored: type}`.

`GET` health probe conserva la respuesta `{ok: true}` original (debug manual).

## Verification Results

- `pnpm exec vitest run` → **123/123 verdes** (19 nuevos en este plan + 104 previos). Test files relevantes:
  - `src/lib/orders/create-from-payment.test.ts` (11 tests)
  - `src/app/api/webhooks/stripe/route.test.ts` (8 tests)
- `pnpm exec tsc --noEmit` → exit 0.
- `grep -rn "stripe\.transfers\.create|transfer_data|application_fee_amount" src/` → 0 matches en codigo de produccion (solo referencias en comentarios y nombre del test de aserción).
- Idempotencia: test verifica que con error `23505` el dispatch NO ocurre.
- Raw body preservado: test verifica que `constructEvent` recibe el `string` exacto (no parsed JSON).

Tests especificos del plan:
```
✓ src/lib/orders/create-from-payment.test.ts (11 tests)
  ✓ happy path: snapshot loaded, all inserts, transition called
  ✓ throws NO_SNAPSHOT_ID
  ✓ throws SNAPSHOT_NOT_FOUND
  ✓ throws StockInsufficientError, no inserts
  ✓ NO incrementa coupon.uses_count (Plan 04 ya reservo)
  ✓ payment.stripe_transfer_id=null + method=stripe (D-SPLIT)
  ✓ artisan_payout: 1 fila/artesano, status=pending
  ✓ order_item preserva snapshot_title + unit_price
  ✓ discount > 0 poblado, artisanNet intacto (D-15)
  ✓ buyer logged-in: order.buyer_id resuelto via buyer table
  ✓ NO importa Stripe SDK (D-SPLIT)
✓ src/app/api/webhooks/stripe/route.test.ts (8 tests)
  ✓ 400 invalid_signature
  ✓ happy path -> 200 + createOrderFromPayment llamado
  ✓ duplicate (23505) -> 200 duplicate=true, no dispatch
  ✓ payment_failed -> 200, sin orden
  ✓ order creation throws -> 200 + error_message flag
  ✓ constructEvent recibe raw body string
  ✓ tipo no manejado -> 200 ignored
  ✓ signature header faltante -> 400
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `totals.perItem` agregado al contrato server-canonical**
- **Found during:** Task 1 — diseño de `createOrderFromPayment`.
- **Issue:** El plan 04 entrega `Totals.perArtisan[]` pero NO datos por linea (snapshot_title, unit_price, productId). El webhook necesita esos campos para crear `order_item` con snapshot inmutable (D-20, COMR-08). Las opciones eran: re-query `product_variant + product` desde el webhook (introduciendo coupling y posible drift de precio si se actualiza entre PI creation y webhook), o extender el contrato de `Totals` con `perItem`. Eleccion: extender (additive, sin romper Plan 04 tests).
- **Fix:** Tipo `PerItemTotal` agregado a `totals.ts`. `computeTotals` lo popula. `stageCart` lo persiste como parte del JSONB. El webhook lo lee directo del snapshot.
- **Files modified:** `src/lib/checkout/totals.ts`, `src/app/api/checkout/payment-intent/route.ts` (passthrough).
- **Commit:** 801b56a.
- **Side effect:** El frontmatter del plan dice `files_modified: [src/lib/orders/create-from-payment.ts, ...]` y no menciona totals.ts. SUMMARY refleja la realidad.

**2. [Rule 2 - Missing critical functionality] `commissionPct` passthrough en stageCart**
- **Found during:** Task 1 — insert de `order.commission_pct_snapshot`.
- **Issue:** `order.commission_pct_snapshot` (NUMERIC(5,2)) es snapshot de la tasa al momento del pago para auditoria. El plan 04 no lo persistia en `cart_snapshot.totals`. Sin el, el webhook tendria que re-query `commission_config` (race posible si el admin cambia la tasa entre PI y webhook).
- **Fix:** `payment-intent/route.ts` agrega `commissionPct` a la llamada `stageCart`. `create-from-payment.ts` lo lee de `snap.totals.commissionPct`.
- **Files modified:** `src/app/api/checkout/payment-intent/route.ts`.
- **Commit:** 801b56a.

**3. [Rule 1 - Bug] `order.buyer_id` apunta a `buyer(id)`, no a `user(id)`**
- **Found during:** Task 1 — primer diseño del insert de order.
- **Issue:** El plan dice "Insert order (status=pending_payment initially per migration 005 default)" con `buyer_id: snap.buyer_id` directo. Pero `snap.buyer_id` (de payload) es el `auth.user.id` (lo que payment-intent recibe en `input.buyer_id`). La FK de `order.buyer_id` apunta a `buyer(id)` (tabla 002_users_roles.sql). Pasar el user_id directamente fallaria con FK violation.
- **Fix:** Lookup `buyer.id` por `user_id` antes del insert. Si falla (compra de invitado real con buyer_id null) → cae al guest_email path. Si encontrado → buyer_id correcto.
- **Files modified:** `src/lib/orders/create-from-payment.ts`.
- **Commit:** 801b56a.
- **Test:** Cubierto por test "buyer logged-in: order.buyer_id se resuelve via buyer table lookup".

**4. [Rule 3 - Blocking] `shipment.courier='flat_rate'` no valido en CHECK constraint**
- **Found during:** Task 1 — diseño de insert de shipment.
- **Issue:** `payload.shipments[].courier` puede ser `'flat_rate'` (fallback cuando el endpoint de cotizacion falla). Pero `shipment.courier` CHECK es `IN ('chilexpress','starken','dhl','fedex','pickup')`. Insertar `'flat_rate'` haria fallar la transaccion completa y el pago quedaria sin orden.
- **Fix:** Mapear `flat_rate -> chilexpress` (proveedor por defecto) en el webhook. El courier real lo actualiza el artesano cuando despacha.
- **Files modified:** `src/lib/orders/create-from-payment.ts`.
- **Commit:** 801b56a.

**5. [Rule 1 - Bug] `webhook_event.id` es la PK, no `event_id`**
- **Found during:** Task 2 — primer diseño del insert.
- **Issue:** El plan menciona "verify col name in migration 007 — assume `event_id` or `id`". La realidad: la PK es `id TEXT` (literal). El insert debe usar `id: event.id`, no `event_id`.
- **Fix:** Insert con `{id: event.id, source: 'stripe', event_type, payload}`. Update con `.eq('id', event.id)`.
- **Files modified:** `src/app/api/webhooks/stripe/route.ts`.
- **Commit:** 30a2ef4.

**6. [Rule 1 - Bug] Cast `Stripe.Event` -> shape interno necesita `unknown` intermedio**
- **Found during:** Task 2 — `pnpm exec tsc --noEmit`.
- **Issue:** El SDK retorna union discriminada compleja (`TreasuryReceivedDebitCreatedEvent | ...`). Cast directo a `{id, type, data: {object: Record<string, unknown>}}` fallaba (TS2352 — types insuficientemente solapados). Se requiere `as unknown as` para descender por `unknown`.
- **Fix:** `as unknown as typeof event` en la asignacion.
- **Files modified:** `src/app/api/webhooks/stripe/route.ts`.
- **Commit:** 30a2ef4.

### Auth Gates / Manual Steps

**Manual verification con stripe-cli** (cuando el dev server este corriendo y supabase local arriba):
```bash
# 1. Aplicar migraciones (incluye 018 + 019 si todavia no estan)
supabase migration up

# 2. En una terminal: levantar Next dev
pnpm dev

# 3. En otra terminal: forwardear webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# anota el whsec_... a STRIPE_WEBHOOK_SECRET en .env.local

# 4. Probar checkout end-to-end con tarjeta de test 4242 4242 4242 4242

# 5. Verificar en DB
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c \
  "SELECT id, status, total, coupon_id FROM \"order\" ORDER BY created_at DESC LIMIT 1;"
psql ... -c "SELECT artisan_id, gross_amount, net_amount, status FROM artisan_payout ORDER BY created_at DESC LIMIT 5;"
psql ... -c "SELECT method, stripe_payment_intent_id, stripe_transfer_id, status FROM payment ORDER BY created_at DESC LIMIT 1;"
# stripe_transfer_id debe ser NULL (D-SPLIT)
```

## Deferred Issues

- **`pnpm test:e2e` no ejecutado** — el worktree no tiene Playwright browsers ni Supabase local. El E2E del flujo checkout -> webhook -> orden visible queda para Plan 07 (smoke E2E del roadmap Phase 3).
- **`pnpm lint`** — falla por conflicto de plugin `@next/next` heredado del worktree (documentado en SUMMARYs de Plans 01, 02, 04). Out of scope.
- **Migrations 018/019/020 sin aplicar localmente** — el worktree no tiene Supabase corriendo. Forward-only; aplicaran en CI/staging/prod. Las llamadas a `decrement_stock_atomic` y `transition_order_status` requieren las RPCs presentes; sin ellas el webhook devuelve 200 + `error_message` flag (la mitigacion T-03-19 cubre el caso).
- **Cleanup job para snapshots/PIs abandonados** (uses_count inflado si buyer abandona) — diferido a Phase 5 (alineado con Plan 04).
- **email send (`order_confirmed` Resend)** — el comentario del plan menciona "Email send: await sendOrderConfirmedEmail(orderId) — wired in Plan 06". No hace nada en Plan 05.
- **`payment_intent.payment_failed` alerting** — Phase 3 minimum loggea unicamente. Phase 4 puede agregar Resend / dashboard alerts.
- **`artisan_payout.period_from/to` con ventana del dia** — placeholder; el periodo real lo establece el job de liquidacion mensual (Phase 5).

## Threat Surface Coverage

Mitigaciones aplicadas segun `<threat_model>` del plan:

- **T-03-16 (Spoofing — webhook fake):** `stripe.webhooks.constructEvent` valida HMAC + timestamp tolerance. Exception → 400 sin tocar DB. Test: `400 si la firma es invalida`.
- **T-03-17 (Repudiation — event reprocessed twice):** PK insert en `webhook_event(id)`. Codigo `23505` → 200 `{duplicate:true}` sin dispatch. Test: `duplicate event (PK 23505)`.
- **T-03-18 (Tampering — body parsed before signature):** `await req.text()` antes de `constructEvent`. Test: `constructEvent recibe el raw body string`.
- **T-03-19 (DoS — Stripe retry tras 5xx):** Errores post-firma siempre devuelven 200 + flag `webhook_event.error_message`. Test: `order creation throws -> 200 + error_message flag`.
- **T-03-20 (Tampering — concurrent stock oversell):** RPC `decrement_stock_atomic` con `SELECT ... FOR UPDATE` row lock per-variant. Mitigacion verificada en migration 018.
- **T-03-21 (Tampering race — coupon double-use):** Plan 04 ya reservo (`reserveCoupon` UPDATE atomico via `reserve_coupon` RPC). El webhook NO incrementa `uses_count` — solo asocia `coupon_id` al order. Test: `NO incrementa coupon.uses_count`.
- **T-03-22 (Information Disclosure — service_role en client):** `admin.ts` server-only por convencion + comentario explicito. Sin `'use client'`. La throw lazy garantiza que falte env var no rompe build (mismo patron que stripe/client.ts). grep audit: `src/lib/supabase/admin.ts` solo importado desde rutas server (`api/webhooks/stripe/route.ts`).

No se introducen flags de threat nuevos no previstos en el plan.

## Self-Check: PASSED

Created files (all FOUND):
- src/lib/orders/create-from-payment.ts
- src/lib/orders/create-from-payment.test.ts
- src/lib/orders/stock-check.ts
- src/lib/supabase/admin.ts
- src/app/api/webhooks/stripe/route.test.ts

Modified files (all FOUND):
- src/app/api/webhooks/stripe/route.ts
- src/lib/checkout/totals.ts
- src/app/api/checkout/payment-intent/route.ts

Commits (all FOUND in git log):
- e0af4b3 — test(03-05): RED — failing tests para createOrderFromPayment + helpers
- 801b56a — feat(03-05): GREEN — createOrderFromPayment transaccional (D-SPLIT)
- 30a2ef4 — feat(03-05): webhook Stripe firma+idempotencia+dispatch (D-21, COMR-07)

TDD Gate Compliance: RED (e0af4b3) → GREEN (801b56a) → feat task 2 (30a2ef4). Refactor no requirido (codigo GREEN ya cohesivo: tipos exportados, separacion clara entre createOrderFromPayment y webhook handler).

Verifications:
- 123/123 unit tests passing (19 nuevos en este plan: 11 + 8)
- `pnpm exec tsc --noEmit` → exit 0
- 0 referencias a Stripe Connect (transfers/destination/transfer_data/application_fee_amount) en codigo produccion
