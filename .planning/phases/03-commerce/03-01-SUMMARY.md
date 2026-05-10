---
phase: 03-commerce
plan: 01
subsystem: foundations
tags: [stripe, migrations, foundations, i18n]
requires: []
provides:
  - "artisan.bank_* fields restored (D-SPLIT)"
  - "cart_snapshot table for PI metadata staging"
  - "decrement_stock_atomic RPC (FOR UPDATE locks)"
  - "webhook_event.error_message column"
  - "stripe server SDK singleton (apiVersion pinned)"
  - "stripe browser loadStripe singleton"
  - "i18n checkout messages (es + en, identical structure, 52 keys)"
affects:
  - "src/types/database.types.ts (regenerated)"
  - "crisol.env.example (D-SPLIT clarified)"
tech-stack:
  added: []
  patterns: ["server-canonical pricing prep", "PI metadata via snapshot id"]
key-files:
  created:
    - "supabase/migrations/015_restore_artisan_bank_fields.sql"
    - "supabase/migrations/016_cart_snapshot.sql"
    - "supabase/migrations/017_seed_coupons.sql"
    - "supabase/migrations/018_decrement_stock_rpc.sql"
    - "supabase/migrations/019_webhook_event_error_message.sql"
    - "src/lib/stripe/client-browser.ts"
    - "messages/es/checkout.json"
    - "messages/en/checkout.json"
  modified:
    - "src/lib/stripe/client.ts"
    - "src/types/database.types.ts"
    - "crisol.env.example"
decisions:
  - "Splitted plan migration 018 into 018 (RPC) + 019 (ALTER TABLE) — local supabase CLI parser cannot handle function-with-comment + ALTER in same file"
  - "Stripe apiVersion pinned at '2024-06-20' via Stripe.LatestApiVersion cast (SDK 17.x exposes only newer literal type)"
  - "i18n checkout namespaced under messages/{locale}/checkout.json per plan; existing single-file convention preserved (request handler still loads messages/{locale}.json)"
metrics:
  completed: "2026-05-09"
  tasks: 2
  commits: 2
requirements: [COMR-06, COMR-07, COUP-01]
---

# Phase 3 Plan 01: Foundations Summary

Cimientos de Phase 3 entregados: 5 migraciones aplicadas (bank fields restored, cart_snapshot, seed coupons, atomic stock RPC, webhook error_message), Stripe SDK server+browser pinneados al apiVersion 2024-06-20, i18n checkout en ambos locales con misma estructura, y documentación de single-account D-SPLIT en crisol.env.example.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Migraciones SQL (bank + cart_snapshot + seeds + RPC + error_message) | 3776d57 | 015–019.sql, database.types.ts |
| 2 | Stripe clients + i18n checkout + env D-SPLIT | 928da45 | stripe/client.ts, stripe/client-browser.ts, messages/{es,en}/checkout.json, crisol.env.example |

## What Was Built

### Migraciones (Task 1)

- **015 — restore_artisan_bank_fields.sql:** ALTER TABLE artisan agrega `bank_name`, `bank_account_type`, `bank_account_number`, `bank_rut`, `bank_email`. CHECK constraint `bank_account_type IN ('checking','savings','sight','rut') OR NULL`. Comentario en `stripe_account_id` lo marca OBSOLETO (D-SPLIT, single-account model — no eliminado por forward-only).
- **016 — cart_snapshot.sql:** tabla con `id UUID PK`, `payload JSONB`, `totals JSONB`, `email`, `buyer_id` FK, `created_at`, `expires_at` (default `now() + 30 min`). Index sobre `expires_at`. RLS habilitado sin policies → deny-all a anon/authenticated; `service_role` bypassea (lo usa el endpoint payment-intent y el webhook Plan 05). Razón: PI metadata limita a 500 chars/key — staging server-side es mandatorio.
- **017 — seed_coupons.sql:** 3 cupones idempotentes vía `ON CONFLICT (code) DO NOTHING`: `CRISOL10` (10%), `BIENVENIDA` (fixed 5000 CLP, min 30000, uses_limit 100), `EXPIRADO` (20% expirado 2024-01-01, conserva flag is_active=true para test de validación de expiración).
- **018 — decrement_stock_rpc.sql:** `decrement_stock_atomic(p_items jsonb)` retorna `TABLE(variant_id uuid, available int, requested int, ok boolean)`. Por cada item toma `FOR UPDATE` lock, valida stock, y decrementa solo si suficiente. Variantes inexistentes y stock insuficiente retornan `ok=false` sin mutar (para que el webhook decida refund vs error).
- **019 — webhook_event_error_message.sql:** `ALTER TABLE webhook_event ADD COLUMN IF NOT EXISTS error_message TEXT`. Bandera para flagging de reconciliación manual desde el webhook.

Tipos regenerados con `supabase gen types typescript --local > src/types/database.types.ts`. La firma del RPC y la nueva tabla `cart_snapshot` están reflejados en el archivo.

### Stripe Clients (Task 2)

- **src/lib/stripe/client.ts:** singleton server-side. `apiVersion: '2024-06-20'` pinneado (Pitfall 7 del research — auto-upgrades silenciosos rompen webhooks). Throw legible si `STRIPE_SECRET_KEY` falta. Comentario explícito: server-only, no importar desde client components.
- **src/lib/stripe/client-browser.ts:** `getStripe()` cachea la promesa de `loadStripe(NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)`. Patrón documentado por Stripe — múltiples `loadStripe` inyectan scripts duplicados.

### i18n (Task 2)

- **messages/es/checkout.json** y **messages/en/checkout.json**: 52 keys idénticas en ambos locales (verificadas con script de diff). Cubre: `cart.*`, `checkout.{contact,address,shipping,coupon,disclaimers,payment,summary}`, `order.*`, `errors.*`. Plural ICU en `summary.items`. Estructura inglés cumple CLAUDE.md (locale `en` debe existir aunque sea preliminar).

### Env (Task 2)

- **crisol.env.example:** comentario del bloque Stripe ampliado con etiqueta explícita "Phase 3 D-SPLIT" + recordatorio de no transfers/no Express. Línea documental `STRIPE_API_VERSION=2024-06-20` (referencia, no se lee en runtime — la versión está pinneada en el SDK).

## Verification Results

- `supabase migration list --local`: 015, 016, 017, 018, 019 listadas como aplicadas.
- `psql … -c "SELECT proname FROM pg_proc WHERE proname='decrement_stock_atomic'"`: 1 fila.
- `psql … -c "SELECT code FROM coupon"`: BIENVENIDA, CRISOL10, EXPIRADO.
- `psql … -c "\d cart_snapshot"`: columnas, FK a `"user"(id)`, index `expires_at`, RLS enabled, sin policies.
- Columnas `bank_*` (5) presentes en `artisan`.
- `pnpm exec tsc --noEmit` → exit 0 (sin errores).
- JSON parse de `messages/{es,en}/checkout.json` → ambos válidos, 52 keys idénticas.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migración 018 dividida en 018 + 019**
- **Found during:** Task 1 — `supabase migration up`.
- **Issue:** El parser del Supabase CLI local (v2.90.0) falla con `ERROR 42601: cannot insert multiple commands into a prepared statement` cuando un archivo combina una función PL/pgSQL (`$$ … $$`) con statements posteriores que incluyen `ALTER TABLE … ADD COLUMN IF NOT EXISTS` + `COMMENT`. Este patrón sí funciona en migraciones existentes (008) pero no en 018 — diferencia probablemente en el shape exacto de tokenización con `IF NOT EXISTS`.
- **Fix:** Movido `ALTER TABLE webhook_event ADD COLUMN error_message …` y su `COMMENT` a un nuevo archivo `019_webhook_event_error_message.sql`. El plan listaba estas dos cosas en el mismo 018; ambas siguen siendo forward-only y aplican antes de Wave 4.
- **Files modified:** `supabase/migrations/018_decrement_stock_rpc.sql` (reducido), `supabase/migrations/019_webhook_event_error_message.sql` (nuevo).
- **Commit:** 3776d57.
- **Side effect:** El `frontmatter.files_modified` del plan menciona 018 con ambas cosas; ahora son dos archivos. SUMMARY refleja la realidad.

**2. [Rule 1 - Bug] Stripe `apiVersion` cast a `Stripe.LatestApiVersion`**
- **Found during:** Task 2 — `pnpm exec tsc --noEmit`.
- **Issue:** Stripe SDK 17.7+ define `LatestApiVersion = '2025-02-24.acacia'`; pasar el literal `'2024-06-20'` al constructor falla con TS2322. El plan exige pin explícito a `'2024-06-20'` (Pitfall 7).
- **Fix:** `const STRIPE_API_VERSION = '2024-06-20' as Stripe.LatestApiVersion`. Cast intencional con comentario explicando la decisión. La pin sigue siendo efectiva en runtime (Stripe acepta cualquier string de fecha-API válido como versión).
- **Files modified:** `src/lib/stripe/client.ts`.
- **Commit:** 928da45.

**3. [Rule 3 - Blocking] Limpieza de stdout en `database.types.ts`**
- **Found during:** Task 1 — primer typecheck post-regen.
- **Issue:** `supabase gen types typescript --local` imprime `Connecting to db 5432\n` a stdout antes del TypeScript. Redirigido junto con la salida útil corrompió el archivo (TS1434 en línea 1).
- **Fix:** Re-generé con `2>/dev/null` para descartar stderr y mantener solo el TypeScript real en stdout. (En realidad la línea iba a stdout — el comando idiomático es `--local 2>/dev/null > file` para silenciar el stderr de Connecting; tras inspección, la línea sí desaparece con stderr suprimido en este Supabase CLI.)
- **Files modified:** `src/types/database.types.ts`.
- **Commit:** 3776d57.

### Auth Gates / Manual Steps

Ninguno.

## Deferred Issues

- **`pnpm lint` falla con conflicto de plugin `@next/next`** entre `.eslintrc.json` del worktree y el del repositorio padre (`../../../.eslintrc.json`). Pre-existente del setup de worktree de Claude Code; reproducible con `git stash` antes de aplicar este plan. Out of scope (no causado por las modificaciones del plan). Logged en `.planning/phases/03-commerce/deferred-items.md` no creado para no contaminar planning artifacts; nota aquí basta.

## Threat Surface Coverage

Mitigaciones aplicadas según `<threat_model>` del plan:

- **T-03-01 (STRIPE_SECRET_KEY disclosure):** `client.ts` solo importable server-side (no `'use client'`, throw inmediato si env missing). Cero `NEXT_PUBLIC_` en su contenido.
- **T-03-02 (cart_snapshot tampering):** RLS habilitado, sin policies → deny-all a roles públicos. Solo `service_role` puede leer/escribir.
- **T-03-03 (bank_* fields disclosure):** Heredan RLS de la tabla `artisan` ya configurada en Phase 1 (admin + propio artesano). Comentarios marcan campos como PII.

No se introducen flags de threat nuevos no previstos en el plan.

## Self-Check: PASSED

Created files (all FOUND):
- supabase/migrations/015_restore_artisan_bank_fields.sql
- supabase/migrations/016_cart_snapshot.sql
- supabase/migrations/017_seed_coupons.sql
- supabase/migrations/018_decrement_stock_rpc.sql
- supabase/migrations/019_webhook_event_error_message.sql
- src/lib/stripe/client-browser.ts
- messages/es/checkout.json
- messages/en/checkout.json

Modified files (all FOUND):
- src/lib/stripe/client.ts
- src/types/database.types.ts
- crisol.env.example

Commits (all FOUND in git log):
- 3776d57 — feat(03-01): migraciones bank fields + cart_snapshot + cupones seed + decrement_stock RPC
- 928da45 — feat(03-01): clientes Stripe + i18n checkout + env D-SPLIT

DB verification:
- Function `decrement_stock_atomic` exists (psql confirmed)
- 3 coupons seeded (CRISOL10, BIENVENIDA, EXPIRADO)
- 5 bank_* columns on artisan
- cart_snapshot table with index + RLS enabled
- webhook_event.error_message column exists

Verifications:
- `pnpm exec tsc --noEmit` → exit 0
- JSON parse of both checkout.json files → valid, 52 identical keys
