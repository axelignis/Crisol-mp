---
phase: 02-catalog-discovery
plan: 04
subsystem: catalog-ui
tags: [catalog, filters, pagination, seo, server-rendering]
dependency_graph:
  requires: [02-01]
  provides: [catalog-page, product-card, product-grid, product-filters, catalog-pagination]
  affects: [catalog-detail-page, search]
tech_stack:
  added: []
  patterns: [server-component-page, client-filter-sidebar, url-searchparams-state, seo-metadata]
key_files:
  created:
    - src/components/catalog/price-display.tsx
    - src/components/catalog/sort-dropdown.tsx
    - src/components/catalog/catalog-pagination.tsx
  modified:
    - src/components/catalog/product-card.tsx
    - src/components/catalog/product-grid.tsx
    - src/components/catalog/product-filters.tsx
    - src/app/[locale]/catalogo/page.tsx
decisions:
  - URL searchParams as single source of truth for filter state (no client state duplication)
  - Separate SortDropdown and CatalogPagination as client components for reusability
  - Slider onValueCommitted (not onChange) to avoid excessive URL pushes during drag
metrics:
  duration: 5m
  completed: 2026-04-13T02:09:00Z
  tasks_completed: 2
  tasks_total: 2
---

# Phase 02 Plan 04: Public Catalog Page Summary

Server-rendered catalog page with responsive product grid, 5-filter sidebar (tipo/material/precio/ocasion/tecnica), sort dropdown, and numbered pagination -- all driven by URL searchParams.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 53d92e9 | Product card, price display, responsive grid components |
| 2 | 9ae8894 | Catalog page with filters, sort, pagination, SEO metadata |

## Key Implementation Details

### Product Card (Server Component)
- Cover photo via next/image with Cloudinary, fallback placeholder SVG
- Visual hierarchy: photo > title > price > artisan name
- Sold overlay with semi-transparent black bg and amber Badge
- Link wraps entire card to `/catalogo/{slug}`

### Product Grid (Server Component)
- Responsive: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`
- Empty state with configurable title/description

### Product Filters (Client Component)
- Desktop: 240px sidebar (`w-60`)
- Mobile: Sheet triggered by "Filtros" button with active count badge
- Checkbox groups for tipo, material, ocasion, tecnica (OR within, AND between)
- Dual-handle Slider for price range with formatCLP labels
- "Limpiar filtros" link resets all params
- All filter changes reset pagina to 1

### Catalog Page (Server Component)
- Parses searchParams with safe defaults and input sanitization
- Parallel data fetch: getPublishedProducts + getFilterOptions
- generateMetadata for SEO title/description
- Empty filtered state with "Limpiar filtros" action link
- 24 items per page with numbered pagination

### Threat Mitigations
- T-02-13: parseInt with NaN fallback for numeric params; enum whitelist for orden; split+filter for array params
- T-02-15: Pagination capped at 24 items via range() in query

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added SortDropdown and CatalogPagination as separate components**
- **Found during:** Task 2
- **Issue:** Plan specified inline sort and pagination but these need 'use client' for useRouter/useSearchParams while the page is a server component
- **Fix:** Created dedicated client components: sort-dropdown.tsx and catalog-pagination.tsx
- **Files created:** src/components/catalog/sort-dropdown.tsx, src/components/catalog/catalog-pagination.tsx

## Known Stubs

None -- all components are wired to real data sources via getPublishedProducts and getFilterOptions queries.

## Self-Check: PASSED

All 7 files verified present. Both commits (53d92e9, 9ae8894) verified in history.
