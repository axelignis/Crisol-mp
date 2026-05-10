---
phase: 03-commerce
plan: 02
subsystem: cart
tags: [cart, zustand, ui, multi-artisan]
requires: ["03-01"]
provides:
  - "useCartStore (Zustand persist + skipHydration)"
  - "useCart() / useCartHydration() hooks SSR-safe"
  - "POST /api/cart/stock-check (D-06 cp1)"
  - "CartSheet slide-over + /carrito full page"
  - "Header con cart trigger global"
  - "Add-to-cart wired en product detail"
affects:
  - "src/app/[locale]/layout.tsx (Header + Toaster mount)"
  - "messages/{es,en}.json (cart namespace top-level)"
tech-stack:
  added: []
  patterns:
    - "Zustand persist con skipHydration + rehydrate gate (anti-hydration-mismatch)"
    - "Server canonical pricing: store es display-only, totales recalc en checkout"
    - "Sheet slide-over con base-ui + sonner toaster"
key-files:
  created:
    - "src/types/cart.ts"
    - "src/hooks/use-cart-hydration.ts"
    - "src/components/cart/cart-hydration.tsx"
    - "src/components/cart/cart-badge.tsx"
    - "src/components/cart/cart-empty.tsx"
    - "src/components/cart/cart-artisan-group.tsx"
    - "src/components/cart/cart-page-client.tsx"
    - "src/app/api/cart/stock-check/route.ts"
    - "tests/e2e/cart-persist.spec.ts"
  modified:
    - "src/store/cart.store.ts"
    - "src/hooks/use-cart.ts"
    - "src/components/cart/cart-sheet.tsx"
    - "src/components/cart/cart-item.tsx"
    - "src/components/layout/header.tsx"
    - "src/app/[locale]/layout.tsx"
    - "src/app/[locale]/carrito/page.tsx"
    - "src/app/[locale]/catalogo/[slug]/product-detail-info.tsx"
    - "messages/es.json"
    - "messages/en.json"
decisions:
  - "Versionado de persist key: 'crisol.cart.v1' — futuras migraciones de schema bumpean version + handler"
  - "byArtisan derivado en el hook con Map (preserva orden de inserción) — más simple que selectors persistidos"
  - "Header montado en locale layout (server) renderiza CartSheet (client) y CartHydration (client) — un solo punto de hidratación global"
  - "Add-to-cart no bloquea por stock=insuficiente del lado UI: lo hace el endpoint y el toast informa; siguiente checkpoint en checkout (D-06 cp2)"
metrics:
  completed: "2026-05-09"
  tasks: 2
  commits: 2
requirements: [COMR-01, COMR-02]
---

# Phase 3 Plan 02: Carrito Persistente Multi-Artesano Summary

Carrito Zustand persistido en localStorage con guard SSR-safe (`skipHydration` + `useCartHydration`), UI completa (slide-over sheet desde header + página full `/carrito`), agrupación por artesano (D-03), integración de add-to-cart en product detail con validación de stock server-side (D-06 cp1), y E2E con persistencia + multi-artisan + contrato del endpoint.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Cart store + hooks + stock-check endpoint | cf26580 | types/cart.ts, store/cart.store.ts, hooks/use-cart{,-hydration}.ts, api/cart/stock-check/route.ts |
| 2 | Cart UI + header + /carrito + add-to-cart wiring + E2E | dab4d74 | cart/{sheet,item,badge,empty,artisan-group,hydration,page-client}, layout/header, locale/layout, catalogo/[slug]/product-detail-info, messages/{es,en}.json, tests/e2e/cart-persist.spec.ts |

## What Was Built

### Cart store (Task 1)

- **`src/types/cart.ts`** — Tipos: `CartItem`, `CartItemsByArtisan`, `StockCheckRequestItem`, `StockCheckResultItem`, `StockCheckResponse` (discriminated union por `ok`).
- **`src/store/cart.store.ts`** — Zustand `create` con `persist` middleware:
  - `name: 'crisol.cart.v1'` (versionable; key con namespace dominio)
  - `storage: createJSONStorage(() => localStorage)` con guard SSR (`typeof window !== 'undefined'`)
  - `skipHydration: true` (per D-02 + research) — la rehidratación se dispara explícitamente desde `useCartHydration`
  - `version: 1`
  - Acciones: `add` (merge por `variantId`), `remove`, `setQty` (qty<=0 → remove), `clear`
- **`src/hooks/use-cart-hydration.ts`** — `useEffect` llama `useCartStore.persist.rehydrate()` y marca `hydrated=true` post-resolve. Side-check `hasHydrated()` por si rehydrate fue sincrónico.
- **`src/hooks/use-cart.ts`** — Selectors derivados: `count`, `subtotal`, `byArtisan` (Map con orden de inserción). Si `!hydrated` retorna estructuras vacías (anti-mismatch).

### Stock-check API (Task 1)

- **`src/app/api/cart/stock-check/route.ts`** — `POST` con Zod schema:
  ```ts
  z.object({ items: z.array(z.object({ variantId: z.string().uuid(), qty: z.number().int().positive() })).min(1).max(50) })
  ```
  Threats mitigados: T-03-05 (DoS, max 50 items), T-03-06 (qty positiva integer). Query a `product_variant.stock` por `id IN (...)`. Retorna `{ ok: true, items: [...] }` o `{ ok: false, insufficient: [...] }` siempre con HTTP 200 para que el cliente decida UX (excepto invalid payload → 400, db error → 500). Variant inexistente se trata como `available=0, sufficient=false`.

### Cart UI (Task 2)

- **`cart-hydration.tsx`** — Trigger sin render que dispara rehydrate global; montado en el header.
- **`cart-badge.tsx`** — Icono shopping bag con badge contador. Si `!hydrated` no renderiza número (evita flicker 0→N).
- **`cart-empty.tsx`** — Estado vacío con CTA "Explorar catálogo" → `/[locale]/catalogo`.
- **`cart-item.tsx`** — Card con imagen Cloudinary (next/image), título snapshot, qty stepper (+/–), precio unitario y línea, botón quitar.
- **`cart-artisan-group.tsx`** — Header con `artisanName` + subtotal del grupo (D-03 multi-artisan visual).
- **`cart-sheet.tsx`** — Slide-over (base-ui Sheet primitive) con grupos + footer (subtotal + CTA checkout + link a carrito completo + nota envío).
- **`cart-page-client.tsx`** — Layout 2 columnas en desktop (items izquierda, resumen sticky derecha). Disclaimers cortos (`shippingNote`, `stockNote`).
- **`/carrito/page.tsx`** — Server component thin wrapper (metadata `robots: noindex`).

### Header + Layout integration (Task 2)

- **`src/components/layout/header.tsx`** — Header sticky con logo, nav (catálogo/artesanos/blog) y `<CartSheet />`. Monta `<CartHydration />` una sola vez. Hasta esta fase era placeholder (`return null`).
- **`src/app/[locale]/layout.tsx`** — Importa y renderiza `<Header locale={locale} />` y `<Toaster />` (sonner) globalmente. Antes el toaster no estaba montado.

### Add-to-cart wiring (Task 2)

- **`product-detail-info.tsx`** (`src/app/[locale]/catalogo/[slug]/`) — Antes tenía botón disabled "Disponible pronto". Ahora:
  - Mantiene state `selectedVariant` (default = primera variante)
  - `handleAddToCart`: POST `/api/cart/stock-check` → si insuficiente, `toast.error` con stock disponible; si OK, `useCart().add(...)` con snapshot (title, unitPrice = base + price_modifier, artisan, image cover) y `toast.success`.
  - Botón habilitado sólo si `!isSold && selectedVariant != null && !isPending`.
  - `data-testid="add-to-cart-button"` con `data-product-id` y `data-variant-id` para E2E.

### i18n (Task 2)

- **`messages/es.json` y `messages/en.json`** — Nuevo namespace top-level `cart` con 22 keys idénticas en ambos locales: `title`, `open`, `empty`, `emptyHint`, `exploreCatalog`, `remove`, `quantity`, `decrease`, `increase`, `subtotal`, `total`, `artisanGroup`, `checkout`, `shippingNote`, `stockNote`, `addedToast`, `stockError`, `stockOut`, `genericError`, `viewFullCart`, `summary`, `items` (ICU plural).

### E2E (Task 2)

- **`tests/e2e/cart-persist.spec.ts`** — 3 grupos `describe`:
  1. **Cart persistence + multi-artisan** — Inyecta state Zustand directamente en `localStorage` vía `addInitScript` (clave `crisol.cart.v1` con shape `{state:{items:[...]},version:1}`). 4 tests:
     - dos grupos artesano + subtotal correcto en `/carrito`
     - badge en header muestra `3` (suma qty)
     - reload preserva el estado
     - quitar item se persiste tras reload
  2. **Empty state** — `/carrito` muestra mensaje vacío sin seed.
  3. **Stock-check API contract** — 4 tests con `request.post`: rechazo 400 para uuid inválido / qty 0 / items vacío; retorno 200 + `ok:false` para variant inexistente (available=0).

  Estrategia "data-independent" (no requiere seed de productos) sigue el patrón de `tests/e2e/catalog.spec.ts`.

## Verification Results

- `tsc --noEmit` (binario `node_modules/.bin/tsc` del repo padre, mismo `tsconfig.json`) → exit 0, sin errores.
- `next build` → completa exitosamente:
  - Ruta nueva registrada: `ƒ /api/cart/stock-check` (dynamic).
  - Ruta `/[locale]/carrito` SSG (4.09 kB) con prerender `/es/carrito` + `/en/carrito`.
  - Ruta `/[locale]/catalogo/[slug]` aumenta de tamaño esperado (5.28 kB → 171 kB First Load JS) por client wiring de add-to-cart.
- E2E suite escrita pero **no ejecutada** — ver "Deferred Verification" abajo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Toaster (sonner) no estaba montado en el árbol**
- **Found during:** Task 2 — al wirear add-to-cart con `toast.success/error`, no había `<Toaster />` global.
- **Issue:** El componente `Toaster` existe en `src/components/ui/sonner.tsx` pero ningún layout lo renderizaba; los toasts no aparecerían.
- **Fix:** Importar y montar `<Toaster />` en `src/app/[locale]/layout.tsx` justo después de `{children}`.
- **Files modified:** `src/app/[locale]/layout.tsx`.
- **Commit:** dab4d74.

**2. [Rule 3 - Blocking] Header era placeholder `return null`**
- **Found during:** Task 2 — el plan asume "Verificar que existe en `src/components/header/`. Si la estructura es distinta…".
- **Issue:** No existe `src/components/header/`; el header vive en `src/components/layout/header.tsx` y devolvía `null`. Además, el locale layout no lo renderizaba.
- **Fix:** Implementar header minimal (logo, nav básica, CartSheet, CartHydration) en `src/components/layout/header.tsx` y montarlo desde el locale layout. UI matches el resto del look del repo (zinc neutrals).
- **Files modified:** `src/components/layout/header.tsx`, `src/app/[locale]/layout.tsx`.
- **Commit:** dab4d74.

**3. [Rule 1 - Bug] `SheetTrigger` con render+children no es estándar base-ui**
- **Found during:** Task 2 — primer borrador del cart-sheet pasaba `<CartBadge />` como children del Trigger junto con `render`.
- **Issue:** El patrón establecido del repo (ver `product-filters.tsx`) es `<SheetTrigger render={<button>…</button>} />`, embebiendo el contenido dentro del `render`.
- **Fix:** Mover `<CartBadge />` al children del button dentro de `render`.
- **Files modified:** `src/components/cart/cart-sheet.tsx`.
- **Commit:** dab4d74.

**4. [Rule 2 - Critical] i18n `cart` namespace ausente en `messages/{es,en}.json`**
- **Found during:** Task 2.
- **Issue:** Plan-01 entregó `messages/{es,en}/checkout.json` (subdir), pero el `i18n/request.ts` carga `messages/{locale}.json`. La clave `cart` que existía en `es.json` era `product.cart.*` (catálogo), no la usable por componentes de carrito.
- **Fix:** Agregar namespace top-level `cart` con 22 keys en ambos `es.json` y `en.json`. Estructura idéntica entre locales (CLAUDE.md).
- **Files modified:** `messages/es.json`, `messages/en.json`.
- **Commit:** dab4d74.

### Auth Gates / Manual Steps

Ninguno.

## Deferred Verification

- **`pnpm test:e2e tests/e2e/cart-persist.spec.ts` no ejecutado.** El worktree no tiene `.env.local` ni dev server corriendo, y el repo no tiene `webServer` configurado en `playwright.config.ts` (asume server externo en `localhost:3001`). Mismo patrón que catalog.spec.ts. La validación funcional (build OK, typecheck OK, código revisado) está completa; la corrida E2E real ocurre en CI/local con server arriba.

## Deferred Issues

- **`pnpm lint`** — Pre-existente del worktree de Claude Code (conflicto de plugin `@next/next` heredado del repo padre). Documentado en SUMMARY de Plan 03-01. Out of scope, no causado por este plan.
- **`Sheet` open controlado para cerrar tras checkout click** — No requerido por el plan; el comportamiento default del Sheet (cierra al click outside) es suficiente. Mejora futura si UX lo pide.
- **`messages/{locale}/checkout.json` (entregado por Plan 03-01) sigue sin estar wired al request handler.** No es responsabilidad de este plan; Plan 03-03 (checkout) lo manejará.

## Threat Surface Coverage

Mitigaciones aplicadas según `<threat_model>` del plan:

- **T-03-04 (Tampering — cart unitPrice en localStorage):** Aceptado per plan. El store es display-only; el server recalcula totales canónicos en payment-intent (Plan 04). Documentado en comentario del store y en este SUMMARY.
- **T-03-05 (DoS — /api/cart/stock-check spam):** Mitigado vía Zod `items.length <= 50`. Rate-limit a Phase 5.
- **T-03-06 (Tampering — qty negativa/cero):** Mitigado vía Zod `int().positive()`; `setQty(0)` en el store mapea a `remove`.

No se introducen flags de threat nuevos.

## Self-Check: PASSED

Created files (all FOUND):
- src/types/cart.ts
- src/hooks/use-cart-hydration.ts
- src/components/cart/cart-hydration.tsx
- src/components/cart/cart-badge.tsx
- src/components/cart/cart-empty.tsx
- src/components/cart/cart-artisan-group.tsx
- src/components/cart/cart-page-client.tsx
- src/app/api/cart/stock-check/route.ts
- tests/e2e/cart-persist.spec.ts

Modified files (all FOUND):
- src/store/cart.store.ts
- src/hooks/use-cart.ts
- src/components/cart/cart-sheet.tsx
- src/components/cart/cart-item.tsx
- src/components/layout/header.tsx
- src/app/[locale]/layout.tsx
- src/app/[locale]/carrito/page.tsx
- src/app/[locale]/catalogo/[slug]/product-detail-info.tsx
- messages/es.json
- messages/en.json

Commits (all FOUND in git log):
- cf26580 — feat(03-02): cart store Zustand persist + hooks + stock-check endpoint
- dab4d74 — feat(03-02): cart UI (sheet + page) + header integration + add-to-cart

Verifications:
- `tsc --noEmit` → exit 0
- `next build` → completes successfully; `/api/cart/stock-check` and `/[locale]/carrito` registered
