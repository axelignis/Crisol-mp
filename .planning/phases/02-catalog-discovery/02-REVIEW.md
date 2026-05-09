---
phase: 02-catalog-discovery
reviewed: 2026-04-12T12:00:00Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - src/app/[locale]/artesanos/[slug]/page.tsx
  - src/app/[locale]/catalogo/[slug]/page.tsx
  - src/app/[locale]/catalogo/[slug]/product-detail-info.tsx
  - src/app/[locale]/catalogo/page.tsx
  - src/app/admin/piezas/revision/page.tsx
  - src/app/api/upload/route.ts
  - src/app/artesano/piezas/[id]/editar/page.tsx
  - src/app/artesano/piezas/nueva/page.tsx
  - src/app/artesano/piezas/page.tsx
  - src/components/admin/moderation-queue.tsx
  - src/components/artisan/artisan-profile-header.tsx
  - src/components/artisan/media-upload-zone.tsx
  - src/components/artisan/piece-wizard.tsx
  - src/components/artisan/variant-table.tsx
  - src/components/catalog/catalog-pagination.tsx
  - src/components/catalog/price-display.tsx
  - src/components/catalog/product-card.tsx
  - src/components/catalog/product-filters.tsx
  - src/components/catalog/product-gallery.tsx
  - src/components/catalog/product-grid.tsx
  - src/components/catalog/sort-dropdown.tsx
  - src/components/catalog/variant-selector.tsx
  - src/lib/actions/moderation-actions.ts
  - src/lib/actions/piece-actions.ts
  - src/lib/cloudinary/upload.ts
  - src/lib/queries/artisan-queries.ts
  - src/lib/queries/product-queries.ts
  - src/lib/resend/client.ts
  - src/lib/resend/templates/piece-approved.tsx
  - src/lib/resend/templates/piece-rejected.tsx
  - src/lib/seo/metadata.ts
  - src/lib/seo/schema.ts
  - src/lib/utils/format.ts
  - src/lib/utils/slugify.ts
  - src/types/catalog.types.ts
  - supabase/migrations/014_seed_catalog.sql
findings:
  critical: 2
  warning: 7
  info: 3
  total: 12
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-12T12:00:00Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

Phase 02 implements catalog discovery: public catalog browsing, product detail, artisan profiles, piece wizard (CRUD), media uploads, admin moderation, and supporting queries/actions. Overall code quality is solid with good Zod validation on server actions and proper auth guards. Two critical issues were found: a missing authorization check in `savePieceDraft` update path (artisan can update any product by ID), and `ProductGrid` on the artisan profile page is called without passing `products` prop, rendering an empty grid. Several warnings relate to missing ownership checks, XSS surface in social links, and an unused `productId` prop.

## Critical Issues

### CR-01: Missing ownership check when updating existing draft in `savePieceDraft`

**File:** `src/lib/actions/piece-actions.ts:90-104`
**Issue:** When `productId` is provided (update path), the action authenticates the user and gets their `artisanId`, but never verifies that `productId` belongs to that artisan. Any authenticated artisan can update any product's title, description, price, and type by passing an arbitrary `productId`.
**Fix:**
```typescript
// After line 65, before the update query:
const { data: existing } = await supabase
  .from('product')
  .select('artisan_id')
  .eq('id', productId)
  .single()
if (!existing || existing.artisan_id !== artisanId) {
  throw new Error('Forbidden: product does not belong to this artisan')
}
```

### CR-02: `ProductGrid` called without `products` prop on artisan profile page

**File:** `src/app/[locale]/artesanos/[slug]/page.tsx:47`
**Issue:** The `products` array is fetched via `getArtisanProducts(artisan.id)` but never passed to `<ProductGrid />`. The component signature requires a `products` prop. This renders an empty grid (or shows the empty state) even when the artisan has published pieces. The conditional `products.length > 0` correctly gates the render, but the data is never passed through.
**Fix:**
```tsx
<ProductGrid products={products} />
```

## Warnings

### WR-01: Missing ownership check in `saveVariants` and `saveMedia`

**File:** `src/lib/actions/piece-actions.ts:107-112` and `src/lib/actions/piece-actions.ts:182-187`
**Issue:** Both `saveVariants` and `saveMedia` authenticate the user but do not verify that `productId` belongs to the authenticated artisan. An artisan could manipulate variants or media on another artisan's product by providing a foreign `productId`. The `submitForReview` action at line 250 similarly lacks this check (though it does check product existence).
**Fix:** Add the same ownership verification pattern as suggested in CR-01 to both functions:
```typescript
const artisanId = await getArtisanId(supabase, user.id)
const { data: product } = await supabase
  .from('product')
  .select('artisan_id')
  .eq('id', productId)
  .single()
if (!product || product.artisan_id !== artisanId) {
  throw new Error('Forbidden')
}
```

### WR-02: Upload API `folder` parameter allows arbitrary path traversal

**File:** `src/app/api/upload/route.ts:13`
**Issue:** The `folder` Zod schema is `z.string().optional().default('crisol/products')`. A malicious authenticated user could specify any folder path (e.g., `../../../other-account`) to upload to arbitrary Cloudinary folders. While Cloudinary folders are not as sensitive as filesystem paths, this could pollute other tenants' storage or bypass organizational structure.
**Fix:**
```typescript
folder: z.string()
  .regex(/^crisol\/[a-z0-9-/]+$/, 'Invalid folder path')
  .optional()
  .default('crisol/products'),
```

### WR-03: `updatePublishedPiece` missing ownership check

**File:** `src/lib/actions/piece-actions.ts:277-313`
**Issue:** This action allows updating a published piece but does not verify the authenticated user owns the product. Any artisan could update another artisan's published piece.
**Fix:** Same ownership verification as CR-01.

### WR-04: Social links in `ArtisanProfileHeader` not validated for protocol

**File:** `src/components/artisan/artisan-profile-header.tsx:44-61`
**Issue:** `artisan.instagram` and `artisan.website` are rendered directly as `href` values. If the database contains a `javascript:` URI or other non-http protocol, this becomes an XSS vector. While this data comes from the database (and presumably validated on write), defense-in-depth is warranted.
**Fix:**
```typescript
const isSafeUrl = (url: string) => /^https?:\/\//i.test(url)

// Then in JSX:
{artisan.instagram && isSafeUrl(artisan.instagram) && (
```

### WR-05: `handlePriceChange` in `ProductFilters` does not handle `readonly number[]` correctly

**File:** `src/components/catalog/product-filters.tsx:83-85`
**Issue:** The callback receives `number | readonly number[]`, but `Array.isArray()` returns `false` for `readonly number[]` in some TS configurations, and the destructuring `const [min, max] = arr` may fail if `arr` is a single number wrapped as `[values, values]`. The fallback `[values, values]` for a single number creates identical min/max, which may not be the intended UX.
**Fix:**
```typescript
const handlePriceChange = useCallback(
  (values: number[]) => {
    // Slider always emits array for range mode
    const [min, max] = values
```

### WR-06: `getMyPieces` uses `!inner` join then re-queries all products

**File:** `src/lib/actions/piece-actions.ts:341-381`
**Issue:** The first query uses `!inner` which excludes products without cover media, then a second query fetches all products to merge them back. This is an N+1-like pattern that doubles the query load. More importantly, the `!inner` join combined with `.eq('product_media.is_cover', true)` means products with media but no cover-flagged photo are also excluded from the cover map.
**Fix:** Use a single query without `!inner` and handle the media join in application code:
```typescript
const { data: products } = await supabase
  .from('product')
  .select(`
    id, title, slug, base_price, type, status, rejection_notes, created_at,
    product_media (url, is_cover)
  `)
  .eq('artisan_id', artisanId)
  .order('created_at', { ascending: false })

return (products ?? []).map(p => ({
  ...p,
  cover_url: p.product_media?.find(m => m.is_cover)?.url ?? p.product_media?.[0]?.url ?? null,
}))
```

### WR-07: `MediaUploadZone` declares `productId` prop but never uses it

**File:** `src/components/artisan/media-upload-zone.tsx:38-39`
**Issue:** The `productId` prop is declared in `MediaUploadZoneProps` but is never referenced in the component body. The destructured props on line 103 omit it. This is dead code that may confuse future maintainers about whether upload operations should be scoped to a product.
**Fix:** Remove `productId` from the interface, or use it in `getUploadSignature()` to scope the Cloudinary folder per product.

## Info

### IN-01: `base_price` allows zero via Zod schema

**File:** `src/lib/actions/piece-actions.ts:16`
**Issue:** `z.number().int().min(0)` allows `base_price = 0`. If the business rule requires a minimum price for published pieces, this should be enforced at submission time or via a higher minimum.
**Fix:** If zero-price is intentional for drafts, add a check in `submitForReview` that `base_price > 0`.

### IN-02: `moderation-queue.tsx` uses `eslint-disable @typescript-eslint/no-explicit-any`

**File:** `src/components/admin/moderation-queue.tsx:34,58-59`
**Issue:** The `any` types on the `normalizePieces` function and `ModerationQueueProps` reduce type safety. The `normalizePieces` function manually maps Supabase join shapes, which could break silently if the query changes.
**Fix:** Type the props using the return type of `getPendingProducts()`:
```typescript
type PendingProductRaw = Awaited<ReturnType<typeof getPendingProducts>>[number]
```

### IN-03: Hardcoded locale `'es'` in revalidation paths

**File:** `src/lib/actions/moderation-actions.ts:102-104` and `src/lib/actions/piece-actions.ts:307-309`
**Issue:** `revalidatePath('/es/catalogo')` hardcodes the Spanish locale. If the English locale is ever fully supported, these paths would need to also revalidate `/en/catalogo`. Consider using a helper that revalidates all supported locales.
**Fix:**
```typescript
import { SUPPORTED_LOCALES } from '@/lib/utils/constants'
for (const locale of SUPPORTED_LOCALES) {
  revalidatePath(`/${locale}/catalogo`)
}
```

---

_Reviewed: 2026-04-12T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
