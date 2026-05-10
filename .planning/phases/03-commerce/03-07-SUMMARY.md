---
plan: 03-07
phase: 03-commerce
status: partial
completed_at: 2026-05-09
---

# Plan 03-07 — Playwright E2E Suite (PARCIAL)

## Estado

**Incompleto** — agente cortado por límite de uso a mitad del plan. Trabajo rescatado y commiteado.

## Entregado

- `playwright.config.ts` — opcional webServer via `PLAYWRIGHT_WEBSERVER=1`.
- `src/test/factories/cart.ts` — builders sin datos hardcodeados.
- `src/test/factories/order.ts` — order + items.
- `src/test/factories/coupon.ts` — flat / percentage.
- `src/test/utils/sign-stripe-webhook.ts` — helper firma webhook para tests.
- `tests/e2e/checkout-happy-path.spec.ts` — flujo multi-artesano.
- `tests/e2e/checkout-guest.spec.ts` — guest checkout (`buyer_id null`).
- `tests/e2e/checkout-disclaimers.spec.ts` — COMR-03 / COMR-09.
- `tests/e2e/checkout-coupon.spec.ts` — cupón.

## Gaps (pendientes para cerrar Wave 6)

- `tests/e2e/checkout-shipping-fallback.spec.ts` — verificar fallback flat-rate cuando courier devuelve timeout.
- `tests/e2e/webhook-idempotency.spec.ts` — replay del mismo `event.id` no duplica orden.
- Validación: correr `pnpm test:e2e` con factories conectadas a Supabase local.
- Documentar setup: cómo arrancar `supabase start` + seed mínimo + `pnpm dev` para que la suite corra completa.

## Cómo retomar

`/gsd-execute-phase 3 --gaps-only` no aplica porque el plan no tiene `gap_closure: true`. Para cerrar:

1. Crear plan complementario `03-08-PLAN.md` con los 2 specs pendientes + setup E2E, o
2. Editar manualmente plan 03-07 para retomar tareas restantes y re-ejecutar.

## Commits rescatados

- `a526413` — factories + 3 specs + playwright config.
- `459736c` — coupon spec + stripe sign helper (parcial).
