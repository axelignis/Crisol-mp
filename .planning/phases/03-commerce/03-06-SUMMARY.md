---
phase: 03-commerce
plan: 06
subsystem: orders-post-payment
tags: [orders, email, post-payment, ui, magic-link, hmac, guest-checkout]
requires: ["03-04", "03-05"]
provides:
  - "signGuestToken / verifyGuestToken (HMAC-SHA256 base64url, timingSafeEqual)"
  - "OrderConfirmedEmail (React Email template, es)"
  - "sendOrderConfirmedEmail (best-effort, no-throw, Resend + service-role)"
  - "/[locale]/pedido/[id] (RSC con auth dual: RLS buyer / token guest)"
  - "GET /api/orders/[id] (Phase 4 dashboards, mismo auth check)"
  - "/checkout/confirmacion redirect a /pedido/{id} (con magic-link si guest)"
  - "Email wire en /api/webhooks/stripe tras createOrderFromPayment"
affects:
  - "src/app/api/webhooks/stripe/route.ts (import + invocacion no-blocking)"
  - "src/app/[locale]/checkout/confirmacion/page.tsx (lookup PI -> redirect)"
tech-stack:
  added: []
  patterns:
    - "Guest token: HMAC sobre payload textual `${orderId}:${email.toLowerCase()}` + base64url; verify usa timingSafeEqual"
    - "Email best-effort: try/catch global, console.error, NUNCA throw — el caller (webhook) no debe fallar"
    - "Auth dual: logged buyer via RLS + buyer.user_id lookup; guest via token verify y service_role solo post-auth"
    - "Confirmacion: lookup payment.stripe_payment_intent_id -> order_id; signGuestToken si guest, redirect a /pedido/{id}"
key-files:
  created:
    - "src/lib/auth/guest-token.ts"
    - "src/lib/auth/guest-token.test.ts"
    - "src/lib/resend/send-order-confirmed.ts"
    - "src/lib/resend/send-order-confirmed.test.ts"
    - "src/app/[locale]/pedido/[id]/page.tsx"
    - "src/app/api/orders/[id]/route.ts"
  modified:
    - "src/lib/resend/templates/order-confirmed.tsx"
    - "src/app/api/webhooks/stripe/route.ts"
    - "src/app/[locale]/checkout/confirmacion/page.tsx"
decisions:
  - "GUEST_TOKEN_SECRET nuevo en lugar de reusar REVALIDATE_SECRET. Reuso introduciria scope creep (la rotacion de revalidate-secret invalidaria magic-links activos) y cross-domain de threat model. La research D-V6 ya recomendaba env separada."
  - "Email best-effort no-blocking. Si Resend falla (rate limit / network) la orden permanece y solo logueamos. Stripe NO debe reintentar el pago (ya succeeded); reintentar el email es out-of-scope (Phase 5 puede agregar retry queue)."
  - "Auth dual con buyer.user_id lookup (no buyer_id == auth.uid()). order.buyer_id apunta a buyer(id), no a user(id) — mismo bug ya documentado en 03-05 SUMMARY."
  - "Confirmacion redirect server-side (no polling client). El callback de Stripe redirige con payment_intent en query; lookup en payment table -> order_id; si encuentra -> redirect. Si no (race con webhook) -> render espera. UX simple sin JS."
  - "Service role usado solo POST-auth. La pagina /pedido/[id] verifica autorizacion con anon-client + RLS o token; recien entonces carga el detalle completo via service_role (necesario para joinear order_item/shipping_address/shipment con relaciones cruzadas)."
metrics:
  completed: "2026-05-09"
  tasks: 2
  commits: 3
requirements: [COMR-08]
---

# Phase 3 Plan 06: Post-pago — Order Detail + Email + Magic-Link Summary

Post-pago UX cerrado: pagina `/pedido/[id]` (auth dual: RLS buyer / HMAC token guest), email transaccional `order-confirmed` (React Email + Resend, best-effort no-blocking), magic-link firmado HMAC-SHA256 para guests, redirect automatico desde `/checkout/confirmacion`. 14 tests nuevos (8 guest-token + 6 send-email), 137/137 globales verdes, `tsc --noEmit` limpio.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 RED | Failing tests guest-token + send-order-confirmed | fb474f1 | guest-token.{ts,test.ts}, send-order-confirmed.{ts,test.ts} |
| 1 GREEN | HMAC sign/verify + template + sender no-blocking | 638011a | guest-token.ts, templates/order-confirmed.tsx, send-order-confirmed.ts |
| 2 | /pedido/[id] page + API + email wire + redirect | 4c6771c | [locale]/pedido/[id]/page.tsx, api/orders/[id]/route.ts, webhooks/stripe/route.ts, checkout/confirmacion/page.tsx |

## What Was Built

### `src/lib/auth/guest-token.ts`
`signGuestToken(orderId, email)` — HMAC-SHA256 sobre `${orderId}:${email.toLowerCase()}` con `process.env.GUEST_TOKEN_SECRET` (server-only, throw lazy si falta). Codifica payload + sig en base64url. `verifyGuestToken(token)` decodifica, recomputa HMAC, compara con `crypto.timingSafeEqual` (mitiga timing-side-channel), retorna `{orderId, email}` o `null` para cualquier fallo (malformado / firma invalida / secret cambiado / payload tampered).

### `src/lib/resend/templates/order-confirmed.tsx`
React Email JSX en español. Header con `# pedido`, lista de items (qty + snapshot_title + precio formato CLP), totales (subtotal/envio/descuento/total), envios por artesano (courier + ETA), direccion de envio, CTA "Ver mi pedido" hacia `${SITE_URL}/es/pedido/{orderId}` (con `?token=...` cuando `magicLinkToken` esta presente), disclaimer (artesanal, no devoluciones salvo defecto), footer Crisol. Props tipados (`OrderConfirmedEmailProps`) para que la unit test pueda spy con `vi.mock('@/lib/resend/templates/order-confirmed')`.

### `src/lib/resend/send-order-confirmed.ts`
`sendOrderConfirmedEmail(orderId): Promise<void>` best-effort:
1. `createServiceRoleClient().from('order').select('*, order_item(*), shipping_address(*), shipment(*)').eq('id', orderId).single()` — bypassa RLS (estamos server-side).
2. Resuelve recipient:
   - Logged buyer (`order.buyer_id` presente) → lookup `buyer.user_id` → `auth.admin.getUserById(userId).user.email`. Fallback secundario: `public.user.email` si la admin API no esta disponible. Sin token.
   - Guest (`buyer_id` null + `guest_email` presente) → `signGuestToken(orderId, guest_email)`.
3. `new Resend(process.env.RESEND_API_KEY)` (instancia local, no la del client.ts singleton — facilita el mock con `vi.mock('resend')`).
4. `resend.emails.send({from: RESEND_FROM_EMAIL ?? FROM_EMAIL ?? 'Crisol <noreply@crisol.cl>', to: recipient, subject: 'Confirmación de pedido #<8charId>', react: OrderConfirmedEmail({order, magicLinkToken})})`.
5. Cualquier excepcion (DB / Resend / template) → `console.error` + return undefined. NUNCA throw — el caller (webhook handler) no debe fallar el procesamiento del pago succeeded.

### `src/app/[locale]/pedido/[id]/page.tsx`
RSC con `dynamic='force-dynamic'` y `robots: noindex`. Auth check:
1. Si hay user autenticado: query anon-client (RLS) sobre `order` + lookup `buyer.id` por `user_id`; autoriza si `order.buyer_id === buyer.id`.
2. Si no autorizado y `searchParams.token` presente: `verifyGuestToken(token)`; autoriza si `verified.orderId === id`.
3. Si ninguno → `notFound()`.

Post-auth carga via service_role el detalle full (order + items + address + shipments) y renderiza con tailwind utilitario: header (`#shortId` + status badge), tabla de items, totales, envios con ETA, direccion. UI minimal, reusable para Phase 4 (artesano view + admin view podran usar la misma estructura).

### `src/app/api/orders/[id]/route.ts`
GET con identica logica de auth (DRY menor — duplicacion deliberada para mantener cada endpoint auto-contenido). Retorna `{order}` JSON o 404. Util para refresh dinamico desde dashboards o polling cliente.

### `src/app/api/webhooks/stripe/route.ts` (modificado)
Tras `createOrderFromPayment` exitoso:
```ts
await sendOrderConfirmedEmail(orderId).catch((emailErr) => {
  console.error('[stripe-webhook] sendOrderConfirmedEmail failed:', emailErr)
})
```
`.catch()` defensivo extra (la funcion ya es no-throw, pero por defensa-en-profundidad). El return 200 con `orderId` es identico a Plan 05 — el email no afecta la respuesta al webhook.

### `src/app/[locale]/checkout/confirmacion/page.tsx` (rewrite)
Stripe redirige tras pago con `?payment_intent=pi_xxx&redirect_status=succeeded`. La page:
1. Lookup `payment.stripe_payment_intent_id == piIntent` via service_role → `order_id`.
2. Si encuentra: si user logged → `redirect(/pedido/{id})`; si guest_email → firma token y `redirect(/pedido/{id}?token=...)`.
3. Si no encuentra (race con webhook todavia procesando) → render "Pedido en proceso" con link a `/cuenta/pedidos`.

UX sin JS: el RSC resuelve el redirect en el primer render. Si el cliente refresca, vuelve a intentar.

## Verification Results

- `pnpm exec vitest run` → **137/137 verdes** (14 nuevos: 8 guest-token + 6 send-email; 123 previos intactos).
- `pnpm exec tsc --noEmit` → exit 0.
- Webhook test suite (Plan 05) sigue verde con el wire del email — `sendOrderConfirmedEmail` no rompe el flujo aunque internamente loguee error por order no encontrada en mocks (best-effort).

Tests especificos del plan:
```
✓ src/lib/auth/guest-token.test.ts (8 tests)
  ✓ roundtrip recovers orderId + lowercase email
  ✓ returns non-empty base64url string
  ✓ tampered payload returns null
  ✓ tampered signature returns null
  ✓ different secret returns null
  ✓ malformed (not base64) returns null
  ✓ empty token returns null
  ✓ token without separator returns null
✓ src/lib/resend/send-order-confirmed.test.ts (6 tests)
  ✓ happy path buyer logged: send 1x sin token
  ✓ guest path: token incluido + envio a guest_email
  ✓ order not found: NO send
  ✓ Resend retorna error: NO throw, console.error
  ✓ no recipient: NO send
  ✓ Resend throw: NO propaga (best-effort)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `Confirmación` regex en test demasiado estricto**
- **Found during:** primera corrida del test happy path.
- **Issue:** Test asertaba `subject` matching `/Confirmación.*order-uuid/i` pero el subject solo incluye los primeros 8 chars del orderId (`order-uu`). Era el test el incorrecto, no la implementacion (la convencion de short-id está alineada con lo que muestra `OrderConfirmedEmail` como `# pedido`).
- **Fix:** Test actualizado a `/Confirmación.*order-uu/i`.
- **Files modified:** `src/lib/resend/send-order-confirmed.test.ts`.
- **Commit:** 638011a (incluido en el commit GREEN).

**2. [Rule 2 - Missing critical functionality] Wire defensivo `.catch()` en webhook**
- **Found during:** Task 2 — diseño del wire.
- **Issue:** `sendOrderConfirmedEmail` ya es no-throw por construccion (try/catch global), pero el plan pedia explicitamente `.catch(e => console.error('[email]', e))`. Mantener doble defensa es trivialmente economico y protege contra refactors futuros que pierdan el try/catch interno.
- **Fix:** Agregado `.catch()` en el wire del webhook ademas del try/catch interno.
- **Files modified:** `src/app/api/webhooks/stripe/route.ts`.
- **Commit:** 4c6771c.

**3. [Rule 3 - Blocking] Email lookup buyer.user_id -> auth.admin.getUserById**
- **Found during:** Task 1 — primer diseño del sender.
- **Issue:** El plan dice "getUserEmail(buyer_id)" sin especificar el camino. La realidad: `order.buyer_id` -> `buyer.id` (por bug-fix de 03-05). Para llegar al email hay que: `buyer.id -> buyer.user_id -> auth.users.email`. Supabase Auth expone `auth.admin.getUserById(userId)` solo con service-role. Fallback opcional a `public.user.email` (si existe).
- **Fix:** Implementado `resolveBuyerEmail()` interno con dos paths (admin API primero, public.user fallback).
- **Files modified:** `src/lib/resend/send-order-confirmed.ts`.
- **Commit:** 638011a.

### Auth Gates / Manual Steps

**Manual verification (cuando el dev server este corriendo + supabase local + Resend test key):**

1. Configurar env:
```bash
GUEST_TOKEN_SECRET=$(openssl rand -hex 32)  # nueva env var
RESEND_API_KEY=re_test_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
RESEND_FROM_EMAIL='Crisol <onboarding@resend.dev>'  # test domain Resend
```

2. Levantar:
```bash
pnpm dev
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# anota whsec_... a STRIPE_WEBHOOK_SECRET
```

3. Test flow logged buyer:
   - Login -> añadir al carrito -> checkout con `4242 4242 4242 4242`.
   - Stripe redirige a `/es/checkout/confirmacion?payment_intent=pi_...&redirect_status=succeeded`.
   - Confirmacion lookup PI -> order_id -> redirect a `/es/pedido/{id}`.
   - Detalle visible (titulo + precio snapshot + envios + direccion).
   - Email recibido por Resend (test inbox).

4. Test flow guest:
   - Sin login -> checkout con `guest_email='guest@example.com'` en form.
   - Tras pago: confirmacion firma token y redirect a `/es/pedido/{id}?token=...`.
   - Email a `guest@example.com` con CTA conteniendo el token.
   - Click magic-link -> `/es/pedido/{id}?token=...` accesible.

5. Test seguridad:
   - `/es/pedido/{otroId}?token=<token-de-otra-orden>` -> 404 (verifyGuestToken rechaza el orderId mismatch).
   - `/es/pedido/{id}?token=tampered-base64` -> 404.
   - `/es/pedido/{id}` sin sesion ni token -> 404.

## Deferred Issues

- **`pnpm test:e2e`** — Playwright browsers no instalados en el worktree. E2E del flujo completo (cart -> checkout -> webhook -> email -> magic-link -> /pedido/[id]) queda para Plan 07 (smoke E2E del roadmap Phase 3).
- **`pnpm lint`** — falla por conflicto de plugin `@next/next` heredado (documentado en SUMMARYs de Plans 01-05). Out of scope.
- **Migrations 018/019/020 sin aplicar localmente** — el worktree no tiene Supabase corriendo. Forward-only; aplicaran en CI/staging/prod.
- **i18n del template y la pagina** — todo el copy esta en `es` literal. La estructura `[locale]` ya existe; agregar `en` traducciones queda para Phase 4 (no bloquea COMR-08).
- **Token expiration / revocation** — el HMAC actual no incluye TTL. Un token firmado vive para siempre (mientras `GUEST_TOKEN_SECRET` no rote). Aceptable para Phase 3 (la cuenta del comprador no es persistente; el email es one-shot). Phase 5 puede agregar `expires_at` claim si se requiere magic-link expirable.
- **API endpoint paginado de orders del buyer** — `/api/orders/[id]` solo retorna una orden. La lista (`/api/orders` con filtros) la hara `/cuenta/pedidos` en Phase 4.
- **Retry queue para emails fallidos** — best-effort sin retry. Phase 5 puede agregar tabla `email_outbox` + cron worker.

## Threat Surface Coverage

Mitigaciones aplicadas segun `<threat_model>` del plan:

- **T-03-23 (Information Disclosure / IDOR `/pedido/{id}`):** auth dual obligatorio: logged buyer (RLS sobre `order` + verificacion buyer.id == order.buyer_id) o guest (verifyGuestToken + orderId match exacto). Sin ninguno -> `notFound()`. Service role usado SOLO post-auth para joinear el detalle.
- **T-03-24 (Tampering / guest token forgery):** HMAC-SHA256 con `GUEST_TOKEN_SECRET` server-only. `crypto.timingSafeEqual` para comparar firmas (mitigacion timing-side-channel). Tests cubren: payload tampered, signature tampered, secret rotado, malformado, empty, sin separator → todos retornan `null`.
- **T-03-25 (Information Disclosure / email PII en token):** aceptado por diseño. El email ya esta en URL del receptor del mensaje; el token no expone PII adicional. La codificacion base64url ofusca pero no oculta. Documentado.
- **T-03-26 (Repudiation / email no enviado):** `resend.emails.send` retorna `{error}` -> `console.error` con detalles (queda en Vercel logs). La orden permanece intacta — el email es best-effort. Defense-in-depth: doble try/catch (interno en `sendOrderConfirmedEmail` + externo `.catch()` en webhook wire).

No se introducen flags de threat nuevos no previstos en el plan.

## Self-Check: PASSED

Created files (all FOUND):
- src/lib/auth/guest-token.ts
- src/lib/auth/guest-token.test.ts
- src/lib/resend/send-order-confirmed.ts
- src/lib/resend/send-order-confirmed.test.ts
- src/app/[locale]/pedido/[id]/page.tsx
- src/app/api/orders/[id]/route.ts

Modified files (all FOUND):
- src/lib/resend/templates/order-confirmed.tsx
- src/app/api/webhooks/stripe/route.ts
- src/app/[locale]/checkout/confirmacion/page.tsx

Commits (all FOUND in git log):
- fb474f1 — test(03-06): RED — failing tests para guest-token + sendOrderConfirmedEmail
- 638011a — feat(03-06): GREEN — guest-token HMAC + email order-confirmed (D-23, D-24)
- 4c6771c — feat(03-06): /pedido/[id] page + API + email wire + confirmacion redirect

TDD Gate Compliance: RED (fb474f1) → GREEN (638011a) → feat task 2 (4c6771c). Refactor no requirido.

Verifications:
- 137/137 unit tests passing (14 nuevos: 8 guest-token + 6 send-email)
- `pnpm exec tsc --noEmit` → exit 0
- Webhook tests previos (Plan 05) intactos con el wire del email (no-blocking)
