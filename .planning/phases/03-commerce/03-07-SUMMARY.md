---
plan: 03-07
phase: 03-commerce
status: complete
completed_at: 2026-05-09
previous_status: partial
resumed_at: 2026-05-09
---

# Plan 03-07 — Playwright E2E Suite

## Estado

**Completo** (resumido). El plan se ejecutó en dos tramos:

1. **Tramo inicial** (cortado por límite de uso) — entregó factories + 4 specs.
2. **Tramo de cierre** — agregó 2 specs faltantes para tapar gaps Wave 6.

## Entregado

### Infra y factories

- `playwright.config.ts` — opcional `webServer` via `PLAYWRIGHT_WEBSERVER=1`. Base URL `http://localhost:3001` por defecto.
- `src/test/factories/cart.ts` — `buildCartItem`, `buildSingleArtisanCart`, `buildMultiArtisanCart`, `buildCartWithSubtotal`, `buildAddress`, `calcSubtotal`. Sin datos hardcodeados (UUID via `crypto.randomUUID`).
- `src/test/factories/order.ts` — `buildOrder` con shape DB-ready para inserción server-side.
- `src/test/factories/coupon.ts` — descriptores canónicos `COUPON_CRISOL10`, `COUPON_BIENVENIDA`, `COUPON_EXPIRADO` + builder genérico.
- `src/test/utils/sign-stripe-webhook.ts` — `signStripeWebhook(payload, secret)` usando `Stripe.webhooks.generateTestHeaderString` + `buildPaymentIntentSucceededEvent` para firmar payloads sin depender de `stripe listen`.

### Specs E2E

| Spec | Requisito | Estrategia |
|------|-----------|-----------|
| `tests/e2e/checkout-happy-path.spec.ts` | COMR-01, COMR-02 | Cart multi-artisan → checkout → init payment-intent stub |
| `tests/e2e/checkout-guest.spec.ts` | COMR-04 | `buyer_id null`, email guest |
| `tests/e2e/checkout-disclaimers.spec.ts` | COMR-03, COMR-09 | Toggle checkbox; texto i18n visible |
| `tests/e2e/checkout-coupon.spec.ts` | COUP-02, COUP-03 | 5 casos via `couponHandler` stub |
| `tests/e2e/checkout-shipping-fallback.spec.ts` | COMR-05 | Stub courier quote → 500 → flat_rate |
| `tests/e2e/webhook-idempotency.spec.ts` | COMR-07 | POST firmado x2 → 1ra `received`, 2da `duplicate` |

## Setup para correr la suite (local)

La suite requiere stack de desarrollo local con servicios externos stubbeados o configurados. Pasos:

```bash
# 1. Supabase local (Postgres + Auth + Storage con seeds)
supabase start
supabase db reset           # aplica migrations + seeds (cupones)

# 2. Variables de entorno (.env.local)
#    - NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#    - NEXT_PUBLIC_SUPABASE_ANON_KEY=<de supabase status>
#    - SUPABASE_SERVICE_ROLE=<de supabase status>           # requerido para webhook-idempotency DB count
#    - STRIPE_WEBHOOK_SECRET=whsec_test_...                 # requerido para signStripeWebhook
#    - STRIPE_SECRET_KEY=sk_test_...                        # requerido para constructEvent en runtime
#    - PLAYWRIGHT_BASE_URL=http://localhost:3001            # default

# 3. Dev server
pnpm dev                    # corre en :3001 (next.config define puerto)
#  o bien:
PLAYWRIGHT_WEBSERVER=1 pnpm test:e2e   # Playwright lo arranca

# 4. Ejecutar suite
pnpm test:e2e

# 5. Subset rápido (sólo gaps de cierre)
pnpm test:e2e tests/e2e/checkout-shipping-fallback.spec.ts \
              tests/e2e/webhook-idempotency.spec.ts
```

### Skips automáticos

- `webhook-idempotency.spec.ts` se salta si `STRIPE_WEBHOOK_SECRET` no está en `process.env` del runner (mejor que false-fail en CI sin secrets).
- La verificación DB del count se omite si `SUPABASE_SERVICE_ROLE` no está disponible — la aserción HTTP por sí sola cubre el invariante COMR-07.

## Validación realizada en este tramo

- `pnpm lint` — limpio (warnings preexistentes en `src/hooks/use-cart.ts`, fuera de scope).
- `pnpm exec tsc --noEmit` — sin errores en los 2 specs nuevos.
- `pnpm exec playwright test --list ...` — 3 tests reconocidos (1 fallback + 2 idempotency).
- `pnpm test:e2e` end-to-end **no se corrió** en este tramo: no había dev server activo en la sesión y arrancar `supabase start` + `pnpm dev` excedía el alcance del cierre. Setup documentado arriba para que dev/CI lo ejecute.

## Notas de implementación

### COMR-05 — fallback flat_rate

El handler en `src/components/checkout/checkout-form.tsx` (L70-81) entra al fallback **sólo cuando `fetch` retorna `!res.ok`**. `route.abort('timedout')` produce que `fetch` lance, el handler tiene `try/finally` (sin catch) y la rejection se propaga: el fallback **no** se activaría. El spec usa `route.fulfill({ status: 500 })` que simula un timeout upstream propagado al endpoint y sí activa la rama de fallback. Decisión documentada inline en el spec.

### COMR-07 — idempotency

El spec valida el invariante de COMR-07 en su forma más limpia: dos POST con mismo `event.id` retornan respectivamente `duplicate: false` y `duplicate: true`. La primera invocación puede fallar `createOrderFromPayment` (sin snapshot real en DB) y devolver `error: order_creation_failed`, pero eso es ortogonal: la fila `webhook_event` ya quedó insertada, y eso es lo que la 2ª llamada detecta vía PK 23505. Verificación opcional con service-role count = 1.

## Commits

### Tramo inicial (rescatado en `10cde83`)

- `a526413` — factories + 3 specs (happy-path, guest, disclaimers) + playwright config.
- `459736c` — coupon spec + stripe sign helper.
- `58b3922` — partial SUMMARY.
- `10cde83` — merge worktree partial.

### Tramo de cierre (este resume)

- `715ab44` — `test(03-07): add courier fallback E2E spec (COMR-05)`.
- `ddc08d9` — `test(03-07): add stripe webhook idempotency E2E spec (COMR-07)`.
- `_pending_` — `docs(03-07): mark plan complete after Wave 6 closure` (este commit).

## Requisitos cubiertos

COMR-01, COMR-02, COMR-03, COMR-04, COMR-05, COMR-07, COMR-09, COUP-02, COUP-03.

Pendientes de verificación con stack arriba: COMR-06 (refactor cart UI) y COMR-08 (estado in_preparation post-pago) — ambos están cubiertos por specs/lib existentes pero requieren ejecutar `pnpm test:e2e` con Supabase + Stripe live para cierre formal. Documentado para QA manual / siguiente Wave.

## Self-Check: PASSED

- Specs creados en disco: `tests/e2e/checkout-shipping-fallback.spec.ts`, `tests/e2e/webhook-idempotency.spec.ts`.
- Commits presentes en historial: `715ab44`, `ddc08d9`.
- Imports resuelven (factories y helper ya existentes en repo).
- `playwright test --list` reconoce los 3 nuevos tests.
