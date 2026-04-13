---
phase: 02-catalog-discovery
plan: 05
subsystem: ui, seo
tags: [next-image, json-ld, schema-org, lightbox, variant-selector, generateMetadata]

requires:
  - phase: 02-catalog-discovery/01
    provides: catalog types, product-queries, artisan-queries, format utilities
provides:
  - Product detail page with gallery, variant selector, dynamic pricing, SEO
  - Artisan profile page with header, social links, published pieces grid, SEO
  - generateProductSchema and generateArtisanSchema for JSON-LD
  - generateProductMetadata and generateArtisanMetadata for Open Graph
affects: [03-commerce, catalog-search, sitemap]

tech-stack:
  added: []
  patterns: [JSON-LD injection via dangerouslySetInnerHTML, lightbox with Dialog component, keyboard navigation in client component]

key-files:
  created:
    - src/components/catalog/variant-selector.tsx
    - src/app/[locale]/catalogo/[slug]/product-detail-info.tsx
  modified:
    - src/components/catalog/product-gallery.tsx
    - src/app/[locale]/catalogo/[slug]/page.tsx
    - src/app/[locale]/artesanos/[slug]/page.tsx
    - src/components/artisan/artisan-profile-header.tsx
    - src/lib/seo/metadata.ts
    - src/lib/seo/schema.ts

key-decisions:
  - "Split product detail info into client component for dynamic price state"
  - "Used Camera icon instead of Instagram (not available in lucide-react version)"
  - "ProductGrid imported as-is from Plan 04 stub -- will render when Plan 04 merges"

patterns-established:
  - "SEO pattern: generateMetadata export + JSON-LD script tag in server component"
  - "Dynamic pricing: client component wraps variant selector with price state"
  - "Lightbox pattern: Dialog overlay with keyboard ArrowLeft/ArrowRight navigation"

requirements-completed: [DISC-03, DISC-04, DISC-05, DISC-06, CATL-09]

duration: 4min
completed: 2026-04-12
---

# Phase 02 Plan 05: Product Detail & Artisan Profile Summary

**Product detail with image gallery/lightbox, chip-based variant selector with dynamic pricing, artisan profile with social links -- both pages with generateMetadata and JSON-LD schemas**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-13T02:04:10Z
- **Completed:** 2026-04-13T02:08:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Product detail page with two-column layout, breadcrumb, gallery with lightbox + keyboard nav
- Variant selector with chip/pill UI, disabled states for out-of-stock, low stock warning badge
- Artisan profile page with circular photo, bio, social links, published pieces grid, empty state
- SEO infrastructure: generateProductMetadata, generateArtisanMetadata, generateProductSchema, generateArtisanSchema

## Task Commits

Each task was committed atomically:

1. **Task 1: Product gallery, variant selector, and product detail page with SEO** - `f44db6c` (feat)
2. **Task 2: Artisan profile page with header, piece grid, and SEO** - `67c852c` (feat)

## Files Created/Modified
- `src/lib/seo/schema.ts` - JSON-LD generators for Product and Person schemas
- `src/lib/seo/metadata.ts` - generateMetadata helpers for product and artisan pages
- `src/components/catalog/product-gallery.tsx` - Image gallery with thumbnails and fullscreen lightbox
- `src/components/catalog/variant-selector.tsx` - Chip/pill variant selector with dynamic pricing
- `src/app/[locale]/catalogo/[slug]/page.tsx` - Product detail server component with SEO
- `src/app/[locale]/catalogo/[slug]/product-detail-info.tsx` - Client component for dynamic price state
- `src/components/artisan/artisan-profile-header.tsx` - Artisan header with photo, bio, social links
- `src/app/[locale]/artesanos/[slug]/page.tsx` - Artisan profile server component with SEO

## Decisions Made
- Split product detail into server page + client info component to keep generateMetadata server-side while enabling dynamic price updates via variant selection
- Used Camera lucide icon for Instagram links since Instagram icon not available in installed lucide-react version
- ProductGrid from Plan 04 is imported as stub -- will render properly once Plan 04 merges its implementation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] lucide-react Instagram icon not available**
- **Found during:** Task 2 (Artisan profile header)
- **Issue:** `Instagram` is not exported from the installed lucide-react version
- **Fix:** Replaced with `Camera` icon as Instagram visual proxy
- **Files modified:** src/components/artisan/artisan-profile-header.tsx
- **Verification:** Build passes
- **Committed in:** 67c852c (Task 2 commit)

**2. [Rule 2 - Missing Critical] Product detail info client component extraction**
- **Found during:** Task 1 (Product detail page)
- **Issue:** Plan spec requires dynamic price updates via variant selection, but page is a server component exporting generateMetadata -- cannot use useState in server component
- **Fix:** Created product-detail-info.tsx as 'use client' component wrapping variant selector and price display
- **Files modified:** src/app/[locale]/catalogo/[slug]/product-detail-info.tsx
- **Verification:** Build passes, variant selector can update price state
- **Committed in:** f44db6c (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both necessary for correctness. No scope creep.

## Known Stubs
- `ProductGrid` in artisan profile page renders null (stub from Plan 04, will be resolved when Plan 04 merges)
- "Agregar al carrito" button is disabled placeholder (intentional, Phase 3 scope)

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Product detail and artisan profile pages fully functional with SEO
- Cart button ready to be wired in Phase 3 commerce implementation
- ProductGrid dependency on Plan 04 will resolve at merge time

---
*Phase: 02-catalog-discovery*
*Completed: 2026-04-12*
