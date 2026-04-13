---
phase: 02-catalog-discovery
plan: 02
subsystem: ui, api
tags: [piece-wizard, cloudinary, server-actions, react-hook-form, dnd-kit, zod]

# Dependency graph
requires:
  - phase: 02-catalog-discovery
    plan: 01
    provides: shadcn/ui components, catalog types, product queries, i18n messages
provides:
  - Server actions for piece CRUD (savePieceDraft, saveVariants, saveMedia, submitForReview, updatePublishedPiece)
  - 4-step piece creation wizard with auto-save on step advance
  - Inline editable variant table (talla/material/color/piedras with stock and price modifier)
  - Cloudinary signed upload endpoint and drag-and-drop media upload zone with reordering
  - Artisan piece list page with status badges and rejection_notes display
  - Edit page for draft and published pieces
affects: [02-moderation-queue, 02-catalog-page, 02-product-detail]

# Tech tracking
tech-stack:
  added: []
  patterns: [server actions with Zod validation, Cloudinary signed upload, dnd-kit sortable for media reorder, react-hook-form per-step validation]

key-files:
  created:
    - src/lib/actions/piece-actions.ts
    - src/components/artisan/piece-wizard.tsx
    - src/components/artisan/variant-table.tsx
    - src/components/artisan/media-upload-zone.tsx
  modified:
    - src/app/api/upload/route.ts
    - src/lib/cloudinary/upload.ts
    - src/app/artesano/piezas/nueva/page.tsx
    - src/app/artesano/piezas/[id]/editar/page.tsx
    - src/app/artesano/piezas/page.tsx

commits:
  - b88caff feat(02-02): server actions for piece CRUD and Cloudinary upload endpoint
  - c184c7f feat(02-02): piece wizard UI with 4-step form and variant table
  - 0d84e7b feat(02-02): media upload zone, page routes, and rejection_notes display
---

# Plan 02-02 Summary: Piece Creation Wizard

## What was built

Artisan piece management: 4-step wizard (info → variants → photos → review & submit) with auto-save, Cloudinary media upload, and piece list with status visibility.

## Key decisions during execution

| Decision | Rationale |
|----------|-----------|
| Server actions with Zod validation on every entry point | Matches CLAUDE.md constraint: all server actions validated with Zod |
| State machine RPC for status transitions | Uses transition_product_status from migration 008 — prevents invalid state jumps |
| Cloudinary signed upload via /api/upload | Follows constraint: uploads only via signature from API route |
| Published pieces edit without re-approval (D-06) | Direct update + ISR revalidation per CATL-11 |
| rejection_notes displayed on changes_requested pieces (D-08) | Amber callout on piece list card so artisans see admin feedback |

## Deviations from plan

None — all 3 tasks completed as specified.

## Concerns for downstream plans

- `src/lib/actions/moderation-actions.ts` referenced in plan but not created here — 02-03 (Admin Moderation Queue) must create it
- Wave 2 sequential execution required because 02-02 and 02-03 both touch moderation-related actions

## Requirements covered

- CATL-01: Piece creation with type, title, description, CLP price
- CATL-02: Variant management (talla/material/color/piedras, stock, price modifier)
- CATL-03: Media upload up to 10 photos via Cloudinary with drag-and-drop reorder
- CATL-04: Draft auto-save on step advance
- CATL-05: Submit for review (draft → pending_review transition)
- CATL-11: Direct edit of published pieces without re-approval
