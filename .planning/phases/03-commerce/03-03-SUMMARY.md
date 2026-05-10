---
phase: 03-commerce
plan: 03
subsystem: couriers
tags: [couriers, integration, tdd, chilexpress, starken]
requires:
  - "Phase 3 Plan 01 foundations (no DB deps; this plan is purely lib + API)"
provides:
  - "lib/couriers facade quote() con timeout 5s + flat-rate fallback"
  - "lib/couriers/quoteForCart() per-artisan fan-out paralelo"
  - "Adapters Chilexpress + Starken (sandbox URLs, env-driven auth)"
  - "Endpoint POST /api/couriers/quote Zod-validated (CL only, groups 1-10)"
  - "FLAT_RATES_BY_REGION (16 regiones de Chile + default)"
affects: []
tech-stack:
  added: []
  patterns:
    - "Promise.race con timeout helper para adapters externos"
    - "Dependency injection en facade (deps?: {quoteChilexpress, quoteStarken}) para testabilidad"
    - "AbortSignal.timeout(4500) interno en cada adapter (margen sub-5s)"
key-files:
  created:
    - "src/lib/couriers/types.ts"
    - "src/lib/couriers/flat-rate.ts"
    - "src/lib/couriers/index.test.ts"
    - "src/app/api/couriers/quote/route.test.ts"
  modified:
    - "src/lib/couriers/index.ts"
    - "src/lib/couriers/chilexpress.ts"
    - "src/lib/couriers/starken.ts"
    - "src/app/api/couriers/quote/route.ts"
decisions:
  - "Chilexpress y Starken URLs/payloads marcados con TODO(verify-sandbox); research dice MEDIUM/LOW-MEDIUM confidence — la pin definitiva vendrá cuando sandbox creds estén disponibles"
  - "Adapter timeout interno (4500ms) sub-5s del facade timeout (5000ms) — evita race condition donde adapter resuelve justo en el límite"
  - "FLAT_RATES_BY_REGION hard-coded en Phase 3, mover a tabla `config` en Phase 4"
  - "ensureCL chequea countryCode tanto en quote() como en quoteForCart() (defensa en profundidad)"
  - "route mapea CL_ONLY→400 con error code 'cl_only' separado de 'invalid_input' (Zod)"
metrics:
  completed: "2026-05-09"
  tasks: 2
  commits: 3
requirements: [COMR-04, COMR-05]
---

# Phase 3 Plan 03: Couriers Adapters & Quote Endpoint Summary

Adapters de couriers con timeout 5s + fallback a tarifa plana, endpoint API que cotiza por artesano. TDD por la criticidad de timeout/fallback (D-11/D-12) y formato de respuesta. 18 tests verdes (9 facade + 9 route), CL-only enforced en dos capas.

## Tasks Completed

| # | Task | Commits | Files |
|---|------|---------|-------|
| 1 | TDD facade quote() + quoteForCart() + flat-rate fallback | e4a9c7d (RED), a46343f (GREEN) | types.ts, flat-rate.ts, index.ts, index.test.ts (+ stubs chilex/starken) |
| 2 | Adapters Chilexpress + Starken + endpoint route + route tests | 45c20e8 | chilexpress.ts, starken.ts, route.ts, route.test.ts |

## What Was Built

### Tipos (Task 1)

`src/lib/couriers/types.ts` define el contrato compartido: `QuoteSource`, `QuoteParams`, `QuoteResult`, `CartArtisanGroup`, `QuoteForCartInput/Result`, `CourierName`, `CourierAdapter`. `QuoteDestination` requiere `countryCode` (string) — el guard `CL` se aplica en runtime, no en el tipo, para permitir mensajes de error claros sin romper compilación cuando el endpoint recibe payloads externos.

### Flat-rate fallback (Task 1)

`src/lib/couriers/flat-rate.ts` exporta `FLAT_RATES_BY_REGION` con 16 regiones de Chile + default (`metropolitana:4990`, `valparaiso:5990`, ..., `default:7990`). `flatRateFallback(params)` normaliza la región (lowercase, strip tildes, strip non-alphanumeric) antes de buscar y retorna `{source:'flat_rate', costClp, etaDays:5}`. Si la región normalizada no matchea, usa `default`.

### Facade (Task 1)

`src/lib/couriers/index.ts`:
- `TIMEOUT_MS = 5000` constante exportada (consumida en tests).
- `timeoutAfter(ms)` helper que rechaza con `Error('TIMEOUT')` después de `ms`.
- `quote(courier, params, deps?)` corre `Promise.race([adapter(params), timeoutAfter(5000)])`. Cualquier rechazo (error de red, HTTP fail, env missing, timeout) es capturado y se retorna `flatRateFallback(params)` con `warning: '${courier}_failed'`. `costClp` siempre se redondea a entero (`Math.round`).
- `quoteForCart({destination, groups, preferredCourier})` paraleliza con `Promise.all` preservando orden. Usa `chilexpress` por defecto si `preferredCourier` no se especifica.
- `ensureCL` se aplica en `quote()` antes del adapter Y en `quoteForCart()` antes del `Promise.all` (defensa en profundidad).
- Dependency injection: `deps?: {quoteChilexpress, quoteStarken}` permite a los tests inyectar mocks sin `vi.mock`. Defaults importan los adapters reales.

### Adapters (Task 2)

`src/lib/couriers/chilexpress.ts`:
- `quoteChilexpress(params)` → POST a `https://testservices.wschilexpress.com/rating/api/v1.0/rates/courier`.
- Header `Ocp-Apim-Subscription-Key: $CHILEXPRESS_API_KEY`. Body con `originCountyCode`, `destinationCountyCode`, `package` (weight/height/width/length como strings), `productType`, `contentType`, `declaredWorth`.
- Si env vars faltan → `Error('CHILEXPRESS_ENV_MISSING')`. HTTP non-2xx → `CHILEXPRESS_HTTP_${status}`. Sin `data.courierServiceOptions[0]` → `CHILEXPRESS_EMPTY_RESPONSE`. Todos caen a flat_rate vía facade.
- `AbortSignal.timeout(4500)` deja 500ms de margen frente al timeout del facade.
- Comentario con `curl` de verificación manual.

`src/lib/couriers/starken.ts`:
- `quoteStarken(params)` → POST a `https://gateway.starken.cl/quote/cotizador` con Basic auth (`STARKEN_USER:STARKEN_PASSWORD` → base64).
- Body `{ alto, ancho, largo, kilos, origen, destino, servicio:'normal' }`.
- Mismos códigos de error que Chilexpress, con prefijo `STARKEN_*`. Mismo timeout interno.

Ambos adapters tienen `TODO(verify-sandbox)` documentado — research del Plan 00 dice MEDIUM/LOW-MEDIUM confidence en la URL/payload exactos. La pin definitiva requiere sandbox creds reales.

### Endpoint (Task 2)

`src/app/api/couriers/quote/route.ts` POST:
- Zod schema con:
  - `destination`: `countryCode: z.literal('CL')` (rechazo automático de no-CL como `invalid_input`)
  - `groups`: `.min(1).max(10)` (límite anti-DoS T-03-08)
  - `package`: todas dimensiones `.positive()` (mitigación T-03-09)
  - `artisanId`: `z.string().uuid()`
  - `preferredCourier`: enum opcional
- Mapping de errores:
  - JSON inválido → 400 `invalid_json`
  - ZodError → 400 `invalid_input` con `details: error.flatten()`
  - `CL_ONLY` lanzado por facade (defensa en profundidad) → 400 `cl_only`
  - Otros errores → 500 `server_error` (logueado)
- Respuesta 200: `{ quotes: [{artisanId, quote: {source, costClp, etaDays, ...}}] }`

## Verification Results

- `pnpm test src/lib/couriers/index.test.ts` → **9/9 verdes** (happy paths, fallback por error, fallback por timeout, country guard, región desconocida, integer cost, multi-artisan parallel preservando orden, country guard a nivel quoteForCart).
- `pnpm test src/app/api/couriers/quote/route.test.ts` → **9/9 verdes** (200 happy, 400 country US, 400 groups vacío, 400 dimensiones negativas, 400 JSON inválido, 400 groups>10, 400 artisanId no-UUID, 400 facade CL_ONLY, 500 facade unexpected).
- `pnpm exec tsc --noEmit` → exit 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `pnpm install` requerido**
- **Found during:** Task 1 — primer `pnpm test`.
- **Issue:** `node_modules/` ausente en el worktree. `vitest: command not found`.
- **Fix:** `pnpm install --prefer-offline`. Build scripts ignorados (esbuild, msw, supabase, unrs-resolver) — irrelevantes para los tests.
- **Files modified:** ninguno (solo node_modules).
- **Commit:** ninguno (efímero).

**2. [Rule 2 - Missing critical functionality] Tests adicionales en route**
- **Found during:** Task 2 — diseño del route test.
- **Issue:** El plan pedía 4+ casos. Agregué 5 más para cubrir vectores de input no contemplados:
  - groups.length > 10 (mitigación T-03-08 explícita)
  - artisanId no-UUID (validación de tipo)
  - JSON malformado (parsing antes de Zod)
  - facade lanza CL_ONLY (defensa en profundidad si futura caller bypassea Zod)
  - facade lanza error inesperado (mapping a 500)
- **Fix:** 9 tests totales en route, todos verdes.
- **Files modified:** `src/app/api/couriers/quote/route.test.ts`.
- **Commit:** 45c20e8.

**3. [Rule 2 - Missing critical functionality] `ensureCL` también en `quoteForCart`**
- **Found during:** Task 1 — implementación GREEN.
- **Issue:** El plan implícitamente espera el guard solo en `quote()`. Pero `quoteForCart` recibe `destination` directamente y solo invoca `quote()` si `groups` no está vacío — un caller con `groups: []` y `countryCode: 'AR'` pasaría `Zod` (groups no vacío) y `quoteForCart` no lanzaría hasta el primer `quote()`. Mejor fail-fast.
- **Fix:** chequeo explícito al inicio de `quoteForCart`. Test agregado: "countryCode !== CL → throws" en quoteForCart.
- **Files modified:** `src/lib/couriers/index.ts`, `src/lib/couriers/index.test.ts`.
- **Commit:** a46343f (GREEN del task 1).

### Auth Gates / Manual Steps

Ninguno requerido en este plan. Las creds de Chilexpress/Starken sandbox están **fuera de scope** — los adapters lanzan `${COURIER}_ENV_MISSING` y el facade cae a flat_rate transparentemente. El checkout (Plan 04) consumirá el endpoint sin bloquear.

Verificación manual (futura, cuando creds disponibles):
```bash
curl -X POST localhost:3000/api/couriers/quote \\
  -H 'Content-Type: application/json' \\
  -d '{ "destination":{"region":"valparaiso","comuna":"vina-del-mar","countryCode":"CL"}, "groups":[{"artisanId":"...","origin":{"region":"metropolitana","comuna":"santiago"},"package":{"weightKg":1,"lengthCm":20,"widthCm":15,"heightCm":10}}] }'
```

## Deferred Issues

- **Sin sandbox creds reales:** los adapters están escritos por research, no validados E2E. Cuando un developer obtenga creds, debe correr el `curl` documentado en cada adapter y ajustar `body` si la respuesta no matchea. Logueado como `TODO(verify-sandbox)` en ambos archivos.
- **Tests E2E Playwright:** CLAUDE.md exige tests E2E para todo feature nuevo. Este plan entrega la base unitaria; el E2E del flujo de checkout cubrirá el endpoint en Plan 04.
- **Rate limiting:** mitigación T-03-08 actual es `groups.length<=10` y timeout de 5s. Rate limit por IP queda diferido a Phase 5 (consistente con threat model del plan).

## Threat Surface Coverage

Mitigaciones del `<threat_model>` del plan:

- **T-03-07 (API keys disclosure):** keys leídas vía `process.env.*` server-only en `chilexpress.ts` y `starken.ts`. Nunca aparecen en respuestas (errores genéricos `*_ENV_MISSING`, `*_HTTP_${status}`). Cero `NEXT_PUBLIC_` en estos archivos.
- **T-03-08 (DoS spam):** Zod limita `groups.length<=10` (test cubre `>10`). Timeout 5s impide hangs. Rate limit por IP diferido (anotado).
- **T-03-09 (dimensiones negativas):** Zod `.positive()` en `weightKg`, `lengthCm`, `widthCm`, `heightCm`. Test cubre el caso negativo.

No se introducen nuevas superficies de ataque: el endpoint es read-only respecto a la BD, no toca `service_role`, no acepta side effects mutables.

## Self-Check: PASSED

Created files (all FOUND):
- src/lib/couriers/types.ts
- src/lib/couriers/flat-rate.ts
- src/lib/couriers/index.test.ts
- src/app/api/couriers/quote/route.test.ts

Modified files (all FOUND):
- src/lib/couriers/index.ts
- src/lib/couriers/chilexpress.ts
- src/lib/couriers/starken.ts
- src/app/api/couriers/quote/route.ts

Commits (all FOUND in git log):
- e4a9c7d — test(03-03): RED — failing tests for couriers quote facade + flat-rate fallback
- a46343f — feat(03-03): GREEN — couriers facade with timeout 5s + flat-rate fallback + per-artisan fan-out
- 45c20e8 — feat(03-03): adapters Chilexpress + Starken + endpoint POST /api/couriers/quote

TDD Gate Compliance: RED (e4a9c7d) → GREEN (a46343f) → feat task 2 (45c20e8). Refactor no necesario (código GREEN ya limpio con DI y helpers extraídos).

Test results:
- 9/9 facade tests passing
- 9/9 route tests passing
- 18/18 total
- `pnpm exec tsc --noEmit` exit 0
