---
phase: 02-catalog-discovery
plan: 01
subsystem: ui, api, database
tags: [shadcn, tailwind, supabase, react-hook-form, dnd-kit, i18n, next-intl]

# Dependency graph
requires:
  - phase: 01-foundation-auth
    provides: database schema (product, artisan, tag tables), Supabase client, constants
provides:
  - shadcn/ui component library (17 components) with Tailwind CSS variable theming
  - catalog TypeScript types (ProductCardData, ProductWithDetails, CatalogFilters, VariantFormData)
  - product query functions with tag-filter intersection logic
  - artisan query functions
  - CLP currency formatter and slug generator
  - i18n messages for catalog, wizard, moderation, artisan UI
affects: [02-catalog-page, 02-product-detail, 02-piece-wizard, 02-moderation, 02-artisan-profile]

# Tech tracking
tech-stack:
  added: [shadcn/ui v4, react-hook-form, @hookform/resolvers, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, tailwindcss-animate, @radix-ui/react-slot, @radix-ui/react-label, @base-ui/react, class-variance-authority, clsx, tailwind-merge, lucide-react, sonner]
  patterns: [HSL CSS variables for theming, cn() utility for className merging, tag-filter intersection (OR-within AND-between)]

key-files:
  created:
    - src/types/catalog.types.ts
    - src/lib/queries/product-queries.ts
    - src/lib/queries/artisan-queries.ts
    - src/components/ui/form.tsx
    - src/components/ui/card.tsx
    - src/components/ui/slider.tsx
    - src/components/ui/tabs.tsx
    - src/components/ui/pagination.tsx
    - src/components/ui/dropdown-menu.tsx
    - src/components/ui/separator.tsx
    - src/components/ui/label.tsx
    - src/components/ui/textarea.tsx
    - src/components/ui/sonner.tsx
  modified:
    - src/lib/utils/format.ts
    - src/lib/utils/slugify.ts
    - messages/es.json
    - messages/en.json
    - tailwind.config.ts
    - src/app/globals.css
    - src/app/layout.tsx
    - package.json
    - src/components/ui/button.tsx
    - src/components/ui/input.tsx
    - src/components/ui/select.tsx
    - src/components/ui/sheet.tsx
    - src/components/ui/dialog.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/skeleton.tsx

key-decisions:
  - "Used shadcn v4 (base-nova style) with @base-ui/react primitives instead of radix-only"
  - "Rewrote globals.css to HSL format for Tailwind v3 compatibility (shadcn v4 outputs oklch for Tailwind v4)"
  - "Replaced Geist font with Inter for Next.js 14 compatibility"
  - "Adapted ArtisanProfile type to actual DB schema: instagram/website fields (not _url suffix), is_suspended (not is_active), no facebook field"
  - "Used sonner for toast notifications (shadcn v4 toast registry removed)"

patterns-established:
  - "cn() utility: merge Tailwind classes via clsx + tailwind-merge"
  - "Tag filter pattern: OR-within-type AND-between-types via product_tag subquery intersection"
  - "CLP formatting: Intl.NumberFormat es-CL with 0 decimals"
  - "Query pattern: createClient() + typed select with relation joins"

requirements-completed: [CATL-09, DISC-01]

# Metrics
duration: 11min
completed: 2026-04-12
---

# Phase 02 Plan 01: Shared Foundation Summary

**shadcn/ui v4 with 17 components, catalog types with tag-filter intersection queries, CLP formatter, and full i18n messages for catalog/wizard/moderation UI**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-12T21:00:38Z
- **Completed:** 2026-04-12T21:12:06Z
- **Tasks:** 2
- **Files modified:** 28

## Accomplishments
- shadcn/ui initialized with 17 production components (button, input, form, card, slider, tabs, pagination, etc.)
- Catalog type system with ProductCardData, ProductWithDetails, CatalogFilters, and wizard form types
- Product queries with tag-filter intersection logic (OR-within-type, AND-between-types) per DISC-02
- CLP formatter using Intl.NumberFormat and slug generator with NFD accent normalization
- Complete i18n message keys for catalog, wizard, moderation, and artisan sections in es/en

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize shadcn/ui and install Phase 2 dependencies** - `a977488` (feat)
2. **Task 2: Create shared types, utilities, queries, and i18n** - `d8608fb` (feat)

## Files Created/Modified
- `components.json` - shadcn/ui configuration (base-nova style)
- `src/lib/utils.ts` - cn() class merging utility
- `src/types/catalog.types.ts` - Shared catalog domain types
- `src/lib/utils/format.ts` - formatCLP and getVariantPrice
- `src/lib/utils/slugify.ts` - URL slug generator with accent removal
- `src/lib/queries/product-queries.ts` - getPublishedProducts, getProductBySlug, getFilterOptions, getPendingProducts
- `src/lib/queries/artisan-queries.ts` - getArtisanBySlug, getArtisanProducts
- `messages/es.json` - Spanish i18n messages (catalog, wizard, moderation, artisan, error)
- `messages/en.json` - English i18n messages (matching structure)
- `tailwind.config.ts` - Extended with HSL CSS variable colors and border-radius
- `src/app/globals.css` - Rewritten for Tailwind v3 with HSL CSS variables
- `src/app/layout.tsx` - Inter font replacing Geist for Next 14
- `src/components/ui/*.tsx` - 17 shadcn components (real implementations replacing stubs)

## Decisions Made
- Used shadcn v4 which ships @base-ui/react primitives; form.tsx manually created with @radix-ui/react-slot since form was removed from v4 registry
- Rewrote globals.css from oklch (Tailwind v4) to HSL (Tailwind v3) format for compatibility
- Replaced Geist font with Inter -- Geist not available in next/font/google for Next.js 14.2
- Adapted types to actual DB schema: artisan uses `instagram`/`website` (not `_url`), `is_suspended` (not `is_active`), no `facebook` column

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn v4 incompatible CSS with Tailwind v3**
- **Found during:** Task 1 (shadcn init)
- **Issue:** shadcn v4 generates oklch colors and @import "shadcn/tailwind.css" requiring Tailwind v4
- **Fix:** Rewrote globals.css with HSL CSS variables compatible with Tailwind v3
- **Files modified:** src/app/globals.css, tailwind.config.ts
- **Verification:** pnpm build passes
- **Committed in:** a977488

**2. [Rule 3 - Blocking] Geist font unavailable in Next.js 14**
- **Found during:** Task 1 (build verification)
- **Issue:** shadcn init added Geist font import which doesn't exist in next/font/google for Next 14
- **Fix:** Replaced with Inter font
- **Files modified:** src/app/layout.tsx
- **Verification:** pnpm build passes
- **Committed in:** a977488

**3. [Rule 3 - Blocking] Form component missing from shadcn v4 registry**
- **Found during:** Task 1 (component installation)
- **Issue:** `npx shadcn add form` silently succeeds but creates no file in v4
- **Fix:** Manually created form.tsx with react-hook-form integration and @radix-ui/react-slot
- **Files modified:** src/components/ui/form.tsx
- **Verification:** tsc --noEmit passes
- **Committed in:** a977488

**4. [Rule 1 - Bug] ArtisanProfile type mismatched actual DB schema**
- **Found during:** Task 2 (type creation)
- **Issue:** Plan specified instagram_url, website_url, facebook_url, is_active; DB has instagram, website, is_suspended, no facebook
- **Fix:** Adapted types and queries to match actual database.types.ts
- **Files modified:** src/types/catalog.types.ts, src/lib/queries/artisan-queries.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** d8608fb

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug)
**Impact on plan:** All fixes necessary for build to pass and types to match actual schema. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 17 shadcn components ready for catalog page, product detail, and wizard UI
- Query functions ready for server components to call
- i18n messages ready for all Phase 2 UI copy
- Types ready for form validation and data display

---
*Phase: 02-catalog-discovery*
*Completed: 2026-04-12*
