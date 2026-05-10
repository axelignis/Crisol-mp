---
status: resolved
trigger: "E2E suite has 9 pre-existing failures: auth strict mode, cart remove vs decrement, moderation+piece-creation login timeouts (missing seed users)"
created: 2026-05-09T00:00:00Z
updated: 2026-05-09T00:00:00Z
---

## Current Focus

hypothesis: Three independent root causes — (1) strict-mode locator collision, (2) remove button decrements qty instead of removing, (3) seed users missing for admin/artisan login.
test: Inspect specs/components, design fixes, run targeted specs.
expecting: All 9 specs green after fixes + seed script.
next_action: Read auth.spec.ts:69, cart-persist.spec.ts:81, cart components, moderation/piece-creation specs, seed.sql, admin.ts.

## Symptoms

expected: pnpm test:e2e all green
actual: 9 failing specs across auth, cart-persist, moderation, piece-creation
errors: strict-mode 2 elements; cart group count not decreasing; login timeout
reproduction: pnpm test:e2e per file
started: pre-existing

## Eliminated

- hypothesis: cart remove button only decrements qty
  evidence: cart-item.tsx llama remove(variantId); store filtra por variantId. La línea 81 falla EN línea 101 (post-reload), no en pre-reload.

## Evidence

- checked: tests/e2e/auth.spec.ts:69
  found: `text=Crisol` matchea link header + h1 hero. Falla strict mode.
- checked: tests/e2e/cart-persist.spec.ts:81
  found: addInitScript reescribe localStorage en cada navigation incl. reload. Tras delete, reload re-inyecta sample original → 2 grupos.
- checked: src/store/cart.store.ts
  found: remove() y setQty() correctos.
- checked: supabase/migrations/002_users_roles.sql
  found: Tabla `user` (singular). Trigger crea ARTISAN auto si role='artisan'. Para crear admin/artisan basta auth.signUp + UPDATE user.role.
- checked: supabase/seed.sql
  found: NO incluye usuarios test admin/artisan.
- checked: src/lib/supabase/admin.ts
  found: Lee SUPABASE_SERVICE_ROLE || SUPABASE_SERVICE_ROLE_KEY.

## Resolution

root_cause: |
  3 root causes independientes:
  1) auth.spec.ts L74 usa selector ambiguo `text=Crisol`.
  2) cart-persist L81 spec defectuoso: addInitScript reescribe storage en reload.
  3) moderation/piece-creation: usuarios seed admin@test.crisol.cl y artisan@test.crisol.cl no existen.
fix: |
  1) usar getByRole('heading', { name: 'Crisol' }).
  2) verificar persistencia leyendo localStorage post-click; quitar reload o usar evaluateOnNewDocument condicional.
  3) crear scripts/seed-e2e-users.ts idempotente con admin API.
files_changed:
  - tests/e2e/auth.spec.ts
  - tests/e2e/cart-persist.spec.ts
  - tests/e2e/moderation.spec.ts
  - tests/e2e/piece-creation.spec.ts
  - scripts/seed-e2e-users.mjs
  - supabase/migrations/021_fix_auth_trigger_search_path.sql
  - package.json
  - CLAUDE.md
verification: pnpm test:e2e → 40/40 passed.
