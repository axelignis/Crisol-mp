# Phase 2: Catalog & Discovery - Research

**Researched:** 2026-04-12
**Domain:** Full-stack Next.js catalog (forms, media upload, admin moderation, public catalog with filtering, SEO)
**Confidence:** HIGH

## Summary

Phase 2 builds the core product lifecycle: artisan creates pieces via a 4-step wizard with variants and Cloudinary media, admin moderates via a list+panel queue, and visitors browse a public catalog with server-rendered filtering, product detail, and artisan profiles. The entire database schema (product, product_variant, product_media, category, tag, product_tag) already exists from Phase 1 migrations. RLS policies are in place. The `transition_product_status` PostgreSQL function handles state machine transitions with row locks. All UI component files exist as empty stubs ready for implementation.

The key technical challenges are: (1) the multi-step wizard with auto-save and Zod validation per step, (2) Cloudinary signed upload with drag-and-drop reordering, (3) server-side catalog filtering with URL query params for SEO-friendly pagination, and (4) ISR revalidation on piece/artisan changes. shadcn/ui must be initialized before any component work since `components.json` does not exist yet.

**Primary recommendation:** Initialize shadcn/ui first, then implement bottom-up: server actions and data layer, then artisan wizard, then admin moderation, then public catalog pages with SEO.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Wizard multi-paso de 4 pasos: (1) Info basica (titulo, tipo, descripcion, precio), (2) Variantes, (3) Fotos, (4) Revisar y enviar
- **D-02:** Mismo formulario para todos los tipos de pieza (unica, serie, arte decorativo) con campos condicionales segun tipo -- serie muestra stock, unica fija stock=1, arte decorativo puede omitir talla
- **D-03:** Auto-save por paso -- cada vez que el artesano avanza de paso se guarda automaticamente como draft. Puede salir y volver donde quedo.
- **D-04:** Drag & drop zone con thumbnails reordenables. Primera foto = portada por defecto, click para cambiar portada. Preview instantaneo antes de subir a Cloudinary.
- **D-05:** Tabla editable inline en paso 2 del wizard. Columnas: tipo (talla/material/color/piedras), valor, stock, modificador de precio (+/- CLP). Boton + para agregar fila.
- **D-06:** Ediciones de piezas publicadas se publican directamente sin re-aprobacion. Modelo familiar -- admin confia en los artesanos.
- **D-07:** Cola de revision con layout lista + panel lateral: lista de piezas pendientes a la izquierda, click abre panel derecho con detalle completo (fotos, variantes, info artesano). Acciones: Aprobar, Pedir cambios, Rechazar.
- **D-08:** Feedback al artesano via mensaje de texto libre del admin. Artesano ve el mensaje en su panel junto a la pieza en estado changes_requested.
- **D-09:** Categorias y tags se seedean en la migracion (datos iniciales). CRUD de categorias/tags desde admin se difiere a Phase 5.
- **D-10:** Grid responsivo: 2 columnas movil, 3 tablet, 4 desktop. Cards con foto portada, titulo, nombre artesano, precio en CLP.
- **D-11:** Sidebar de filtros a la izquierda: tipo de pieza, material, rango de precio (slider), ocasion, tecnica. En movil colapsa a boton "Filtros" que abre sheet.
- **D-12:** Logica de filtros: OR dentro de un mismo filtro (Plata O Oro), AND entre filtros distintos (Material AND Tipo). Estandar e-commerce.
- **D-13:** Paginacion clasica numerada al fondo. 12-24 piezas por pagina. Compatible con SSG/ISR y SEO.
- **D-14:** Galeria con foto principal grande + fila de thumbnails abajo. Click en thumbnail cambia principal. Click en principal abre lightbox fullscreen.
- **D-15:** Selector de variantes con botones tipo chip/pill agrupados por tipo. Seleccion actualiza precio dinamicamente. Stock bajo muestra badge "Quedan N unidades".
- **D-16:** Header con foto, nombre, bio y redes sociales. Debajo: grid de sus piezas publicadas (mismo estilo catalogo).

### Claude's Discretion
- SEO metadata y JSON-LD specifics (generateMetadata implementation)
- Exact sort/order options for catalog (relevancia, precio, fecha)
- Empty states design (catalogo sin resultados, artesano sin piezas)
- Product viewer 3D integration details (product-viewer-3d.tsx exists)
- Sold pieces display in artisan portfolio (badge "Vendida" overlay)
- Lightbox implementation approach
- Filter URL query parameter structure
- Notification email templates for piece approval/rejection (CATL-07)
- ISR revalidation trigger implementation (DISC-05, route exists)

### Deferred Ideas (OUT OF SCOPE)
- CRUD de categorias/tags desde admin panel -- Phase 5 (Dashboards & Operations)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CATL-01 | Artesano puede crear pieza con tipo, titulo, descripcion y precio en CLP | Wizard step 1 + server action using product table. Zod schema validates fields. |
| CATL-02 | Artesano puede crear variantes por pieza (talla, material, color, piedras) con stock y modificador de precio | Wizard step 2 + inline variant table. product_variant table with price_modifier INTEGER. |
| CATL-03 | Artesano puede subir hasta 10 fotos (JPG/PNG/WebP) con auto-conversion WebP/AVIF via Cloudinary | /api/upload endpoint with Cloudinary signed upload. DB trigger enforces 10-photo limit. |
| CATL-04 | Artesano puede definir foto de portada y ordenar galeria | product_media.is_cover + sort_order. @dnd-kit for drag reorder. |
| CATL-05 | Pieza nueva entra en estado draft; artesano la envia a revision (pending_review) | transition_product_status RPC: draft -> pending_review. |
| CATL-06 | Admin puede aprobar (published), solicitar cambios (changes_requested) o rechazar (rejected) una pieza | transition_product_status RPC: pending_review -> published/changes_requested/rejected. Admin moderation queue. |
| CATL-07 | Artesano recibe notificacion email del resultado de revision | Resend + React Email templates piece-approved.tsx, piece-rejected.tsx (stubs exist). |
| CATL-08 | Solo piezas en estado published son visibles en el catalogo publico | RLS policy "product: publicados visibles para todos" already enforces status IN ('published', 'sold'). |
| CATL-09 | Piezas vendidas permanecen visibles como portafolio del artesano (estado sold) | Same RLS policy includes 'sold'. UI shows "Vendida" badge overlay. |
| CATL-10 | Admin puede gestionar categorias y tags jerarquicos | Seed data in migration. Admin CRUD deferred to Phase 5 per D-09. |
| CATL-11 | Ediciones menores de piezas publicadas se publican directamente sin re-aprobacion | D-06: direct edit on published pieces, no state transition needed. |
| DISC-01 | Visitante puede explorar catalogo publico con paginas SSG/ISR | /es/catalogo page with server-side data fetching. Pagination via searchParams. |
| DISC-02 | Visitante puede filtrar por tipo de pieza, material, rango de precio, ocasion y tecnica | URL query params + server-side Supabase query with tag joins. Sheet for mobile. |
| DISC-03 | Visitante puede ver perfil publico de artesano con URL amigable (/artesano/slug) | /es/artesanos/[slug] page. Artisan table has slug column. |
| DISC-04 | Visitante puede ver detalle de pieza con galeria, variantes y precio | /es/catalogo/[slug] page with product + variants + media joins. |
| DISC-05 | Cambios en pieza/artesano disparan revalidacion ISR on-demand | /api/revalidate endpoint (stub exists). Call revalidatePath/revalidateTag after mutations. |
| DISC-06 | Paginas de producto y artesano incluyen generateMetadata para SEO basico | generateMetadata + JSON-LD (Product schema, Person schema). UI-SPEC defines exact formats. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack:** Next.js 14 App Router, TypeScript, Tailwind, next-intl (es default, en), Zustand, Zod, Supabase, Cloudinary, Resend + React Email, pnpm
- **Files:** kebab-case.tsx for components, use-*.ts for hooks, PascalCase for types, camelCase for functions
- **DB:** Tables and columns snake_case, forward-only migrations, never edit applied migrations, regenerate database.types.ts after each migration
- **Security:** RLS active on every table, service_role only server-side, never expose NEXT_PUBLIC_* secrets
- **Validation:** All external input (API routes, server actions, webhooks) validated with Zod
- **Media:** Uploads only via Cloudinary signed upload from /api/upload. Respect MAX_PHOTOS_PER_PRODUCT (10)
- **Prices:** Canonical in CLP (INTEGER), USD is display-only
- **State machine:** Strict product statuses via transition_product_status function, no skipping states
- **ISR:** Changes in piece/artisan/blog trigger on-demand revalidation via REVALIDATE_SECRET
- **SEO:** generateMetadata + JSON-LD on public pages
- **i18n:** es mandatory, en structure must exist
- **Import alias:** @/ -> src/
- **Testing:** E2E in Playwright, test files in tests/e2e/<feature>.spec.ts, use factories from src/test/factories/
- **Git:** Never push, show push command for user. Commit format: type(scope): description

## Standard Stack

### Core (already in package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 14.2.15 | App Router, ISR, generateMetadata, server actions | Project-locked version [VERIFIED: package.json] |
| @supabase/supabase-js | ^2.45.4 | Database queries, RPC calls | Project-locked [VERIFIED: package.json] |
| @supabase/ssr | ^0.5.1 | Server-side Supabase client with cookies | Project-locked [VERIFIED: package.json] |
| cloudinary | ^2.5.1 | Signed upload, image transformations | Project-locked [VERIFIED: package.json] |
| resend | ^4.0.0 | Transactional email sending | Project-locked [VERIFIED: package.json] |
| @react-email/components | ^0.0.25 | Email templates in JSX | Project-locked [VERIFIED: package.json] |
| zod | ^3.23.8 | Schema validation for forms and API input | Project-locked [VERIFIED: package.json] |
| next-intl | ^3.20.0 | i18n routing and translations | Project-locked [VERIFIED: package.json] |
| tailwindcss | ^3.4.13 | Utility CSS | Project-locked [VERIFIED: package.json] |

### New Dependencies (to install)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | 7.72.1 | Form state management for wizard | shadcn Form component requires it. Best React form lib. [VERIFIED: npm registry] |
| @hookform/resolvers | 5.2.2 | Zod resolver for react-hook-form | Bridges Zod schemas to react-hook-form validation [VERIFIED: npm registry] |
| @dnd-kit/core | 6.3.1 | Drag and drop primitives | Standard for React DnD. Accessible, performant. [VERIFIED: npm registry] |
| @dnd-kit/sortable | 10.0.0 | Sortable list preset for thumbnail reordering | Built on @dnd-kit/core [VERIFIED: npm registry] |
| @dnd-kit/utilities | latest | CSS transform utilities for dnd-kit | Companion to @dnd-kit [ASSUMED] |
| lucide-react | 1.8.0 | Icon library | shadcn default icon library [VERIFIED: npm registry] |
| class-variance-authority | 0.7.1 | Component variant definitions | shadcn dependency [VERIFIED: npm registry] |
| clsx | 2.1.1 | Conditional class merging | shadcn dependency [VERIFIED: npm registry] |
| tailwind-merge | 3.5.0 | Tailwind class deduplication | shadcn cn() utility [VERIFIED: npm registry] |

### shadcn/ui Components (not npm packages -- generated via CLI)

Components to install via `npx shadcn@latest add`: button, input, textarea, select, sheet, dialog, badge, skeleton, card, slider, tabs, separator, label, dropdown-menu, pagination, form, toast.

**Installation:**
```bash
# shadcn initialization (MUST run before any component work)
npx shadcn@latest init

# New npm dependencies
pnpm add react-hook-form @hookform/resolvers @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# shadcn will auto-install lucide-react, clsx, tailwind-merge, class-variance-authority

# shadcn components (run after init)
npx shadcn@latest add button input textarea select sheet dialog badge skeleton card slider tabs separator label dropdown-menu pagination form toast
```

## Architecture Patterns

### Relevant Project Structure
```
src/
  app/
    [locale]/
      catalogo/
        page.tsx                    # Catalog listing (server component, searchParams for filters)
        [slug]/
          page.tsx                  # Product detail (server component, ISR)
      artesanos/
        [slug]/
          page.tsx                  # Artisan profile (server component, ISR)
    artesano/
      piezas/
        page.tsx                    # My pieces list (server component)
        nueva/
          page.tsx                  # Wizard host page (server component loads draft if exists)
        [id]/
          editar/
            page.tsx                # Edit piece (same wizard, pre-populated)
      perfil/
        page.tsx                    # Edit public profile
    admin/
      piezas/
        revision/
          page.tsx                  # Moderation queue
    api/
      upload/
        route.ts                    # Cloudinary signed upload
      revalidate/
        route.ts                    # ISR on-demand trigger
  components/
    artisan/
      piece-wizard.tsx              # 4-step wizard container (client component)
      variant-table.tsx             # Inline editable variant table (client component)
      media-upload-zone.tsx         # DnD upload zone (client component)
    admin/
      moderation-queue.tsx          # List + side panel (client component)
    catalog/
      product-card.tsx              # Card (server component)
      product-grid.tsx              # Grid (server component)
      product-filters.tsx           # Sidebar filters (client component for interactions)
      product-gallery.tsx           # Gallery + lightbox (client component)
      variant-selector.tsx          # Chip selector (client component)
      price-display.tsx             # CLP formatter (server or client)
  lib/
    actions/
      piece-actions.ts              # Server actions: saveDraft, submitForReview, updatePiece
      moderation-actions.ts         # Server actions: approvePiece, requestChanges, rejectPiece
    queries/
      product-queries.ts            # Reusable Supabase queries for catalog
      artisan-queries.ts            # Artisan profile queries
    cloudinary/
      client.ts                     # Cloudinary SDK config (stub exists)
      upload.ts                     # Signed upload helpers (stub exists)
    resend/
      client.ts                     # Resend SDK init (stub exists)
      templates/
        piece-approved.tsx          # Approval email (stub exists)
        piece-rejected.tsx          # Rejection email (stub exists)
    seo/
      metadata.ts                   # generateMetadata helpers (stub exists)
      schema.ts                     # JSON-LD generators (stub exists)
    utils/
      format.ts                     # Price formatting (stub exists)
      slugify.ts                    # Slug generation (stub exists)
```

### Pattern 1: Server Actions for Mutations

**What:** Use Next.js server actions (not API routes) for all piece CRUD and moderation actions. API routes reserved for external integrations (upload signing, webhooks, revalidation).

**When to use:** Any form submission or mutation from authenticated users.

**Example:**
```typescript
// src/lib/actions/piece-actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const PieceStep1Schema = z.object({
  type: z.enum(['jewelry_unique', 'jewelry_series', 'decorative']),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  basePrice: z.number().int().min(0),
})

export async function savePieceDraft(productId: string | null, data: z.infer<typeof PieceStep1Schema>) {
  const parsed = PieceStep1Schema.parse(data)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  if (productId) {
    // Update existing draft
    const { error } = await supabase
      .from('product')
      .update({ ...parsed, base_price: parsed.basePrice })
      .eq('id', productId)
    if (error) throw error
    return productId
  } else {
    // Create new draft -- artisan_id resolved by RLS
    const { data: product, error } = await supabase
      .from('product')
      .insert({
        title: parsed.title,
        type: parsed.type,
        description: parsed.description,
        base_price: parsed.basePrice,
        status: 'draft',
        slug: '', // Will be generated
        artisan_id: '', // Need to fetch from artisan table
      })
      .select('id')
      .single()
    if (error) throw error
    return product.id
  }
}
```
[ASSUMED -- pattern follows Next.js 14 App Router conventions]

### Pattern 2: Server-Side Catalog Filtering via searchParams

**What:** Catalog page reads URL searchParams on the server, builds Supabase query with filters, returns pre-rendered HTML. No client-side data fetching.

**When to use:** Public catalog listing (/es/catalogo).

**Example:**
```typescript
// src/app/[locale]/catalogo/page.tsx
import { createClient } from '@/lib/supabase/server'

interface CatalogPageProps {
  searchParams: Promise<{
    tipo?: string
    material?: string
    precio_min?: string
    precio_max?: string
    ocasion?: string
    tecnica?: string
    pagina?: string
    orden?: string
  }>
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const page = parseInt(params.pagina ?? '1', 10)
  const perPage = 24
  const offset = (page - 1) * perPage

  let query = supabase
    .from('product')
    .select(`
      id, title, slug, base_price, type, status,
      artisan:artisan_id (id, slug, user:user_id (full_name)),
      media:product_media!inner (url, is_cover),
      tags:product_tag (tag:tag_id (slug, type))
    `, { count: 'exact' })
    .in('status', ['published', 'sold'])
    .eq('product_media.is_cover', true)
    .order('published_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  // Apply filters from searchParams...
  // Each filter adds .in() or .gte()/.lte() conditions

  const { data: products, count } = await query
  // Render grid + pagination
}
```
[ASSUMED -- follows Supabase query patterns for Next.js]

### Pattern 3: Cloudinary Signed Upload Flow

**What:** Client requests a signature from /api/upload, uploads directly to Cloudinary from browser, saves URL + cloudinary_id to product_media table.

**When to use:** Media upload zone in wizard step 3.

**Flow:**
1. Client sends `POST /api/upload` with metadata (product_id, eager transformations)
2. Server generates Cloudinary signature using secret (never exposed to client)
3. Client uploads directly to `https://api.cloudinary.com/v1_1/{cloud}/image/upload` with signature
4. On success, client saves media record via server action
5. Cloudinary auto-converts to WebP/AVIF via eager transformations

### Pattern 4: ISR Revalidation on Mutations

**What:** After any server action that changes a published piece or artisan profile, call `revalidatePath()` or `revalidateTag()` to bust ISR cache.

**When to use:** After piece approval, piece edit, artisan profile update.

**Example:**
```typescript
// After approving a piece
revalidatePath('/es/catalogo')
revalidatePath(`/es/catalogo/${product.slug}`)
revalidatePath(`/es/artesanos/${artisan.slug}`)
```
[VERIFIED: Next.js 14 supports revalidatePath in server actions -- CITED: nextjs.org/docs/app/api-reference/functions/revalidatePath]

### Anti-Patterns to Avoid

- **Client-side catalog fetching:** Public catalog MUST be server-rendered for SEO. Never useEffect + fetch for the main grid.
- **Direct Cloudinary upload without signing:** Always go through /api/upload for signature. Cloudinary API secret must never reach the client.
- **Skipping state machine:** Never UPDATE product.status directly. Always call `transition_product_status` RPC which validates transitions and applies side effects.
- **Hardcoding filter values:** Filter options (materials, techniques, occasions) come from the `tag` table. Seed data defines them, UI reads dynamically.
- **Floating point prices:** All prices are INTEGER CLP. Use `format.ts` for display formatting only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state + validation | Custom useState per field | react-hook-form + @hookform/resolvers/zod | Multi-step wizard with per-step validation, dirty tracking, auto-save detection |
| Drag and drop | HTML5 DnD API or manual pointer events | @dnd-kit/sortable | Accessibility (keyboard, screen reader), touch support, collision detection |
| Image lightbox | Custom modal with gesture handling | shadcn Dialog + custom keyboard nav | Focus trap, escape handling, accessibility |
| Price formatting (CLP) | String manipulation | Intl.NumberFormat with 'es-CL' locale | Handles thousands separator (dot), no decimals, locale-aware |
| Slug generation | Manual regex | slugify utility with unaccent | Spanish characters (tildes, n), collision handling |
| Pagination | Custom offset logic | shadcn Pagination + server-side range() | SEO-friendly page URLs, a11y |
| Email templates | HTML strings | React Email components | Consistent rendering across clients, type-safe |

**Key insight:** The wizard alone has enough complexity (4 steps, per-step validation, auto-save, conditional fields by piece type, variant table, media DnD) to justify react-hook-form + @dnd-kit rather than custom state management.

## Common Pitfalls

### Pitfall 1: RLS Blocking Admin Reads of Pending Pieces
**What goes wrong:** Admin moderation queue returns empty because RLS policy "product: publicados visibles para todos" only allows status IN ('published', 'sold').
**Why it happens:** The admin FOR ALL policy exists, but the admin must be authenticated with the correct JWT role claim.
**How to avoid:** Verify the admin policy "admin: gestionar todas las piezas" works correctly. The `user_role()` function reads from JWT claim `user_role`. Ensure the auth hook (migration 011) properly sets this claim.
**Warning signs:** Moderation queue shows no items even when pending_review products exist.

### Pitfall 2: Cloudinary Upload Signature Expiry
**What goes wrong:** Uploads fail intermittently with "Invalid Signature" error.
**Why it happens:** Cloudinary signatures expire (default 1 hour). If user takes long on wizard step 3, the signature is stale.
**How to avoid:** Generate signature per-upload (not per-session). If upload fails with signature error, auto-retry by requesting new signature.
**Warning signs:** Upload failures reported by users who spend a long time composing their piece.

### Pitfall 3: N+1 Queries in Catalog Grid
**What goes wrong:** Catalog page is slow because each product card triggers separate queries for media, artisan, and tags.
**Why it happens:** Using separate queries per card instead of a single joined query.
**How to avoid:** Use Supabase's nested select syntax to fetch product + media (is_cover=true) + artisan + tags in one query. The indexes `idx_media_cover` and `idx_product_published` support this.
**Warning signs:** Catalog page load time > 500ms, visible in Lighthouse.

### Pitfall 4: Filter State Desync Between URL and UI
**What goes wrong:** User applies filters, shares URL, recipient sees different results or filters don't reflect in UI.
**Why it happens:** Filter state managed in client state (useState) without syncing to URL searchParams.
**How to avoid:** URL searchParams are the single source of truth. Filters read from searchParams, changes update URL via router.push (shallow). Server component reads searchParams for query.
**Warning signs:** Filters reset on page refresh or back navigation.

### Pitfall 5: ISR Cache Not Clearing After Approval
**What goes wrong:** Admin approves piece but it doesn't appear in public catalog.
**Why it happens:** Forgot to call revalidatePath after state transition, or revalidated the wrong path.
**How to avoid:** Every server action that changes product status or artisan profile MUST call revalidatePath for all affected public pages (catalog index, product detail, artisan profile).
**Warning signs:** "I approved the piece but I don't see it in the catalog" -- manual browser refresh fixes it.

### Pitfall 6: product_media.is_cover Inconsistency
**What goes wrong:** Multiple photos marked as cover, or no photo marked as cover.
**Why it happens:** No DB constraint enforcing exactly one cover per product. Application logic must manage it.
**How to avoid:** When setting a new cover, first unset all is_cover=false for that product_id, then set the new one. Wrap in a transaction or use a single UPDATE + INSERT pattern.
**Warning signs:** Product cards show random or no photos.

### Pitfall 7: Variant Price Modifier Confusion
**What goes wrong:** Displayed price is wrong (negative price, or modifier applied twice).
**Why it happens:** product_variant.price_modifier is an INTEGER added to product.base_price. If the UI adds it multiple times or doesn't handle negative modifiers correctly.
**How to avoid:** Single utility function: `getVariantPrice(basePrice, priceModifier) => basePrice + priceModifier`. Validate total >= 0. Use this everywhere.
**Warning signs:** Prices look wrong in product detail when selecting variants.

## Code Examples

### CLP Price Formatting
```typescript
// src/lib/utils/format.ts
export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function getVariantPrice(basePrice: number, priceModifier: number): number {
  return Math.max(0, basePrice + priceModifier)
}
```
[VERIFIED: Intl.NumberFormat is built-in, 'es-CL' produces "$XX.XXX" format]

### Slug Generation
```typescript
// src/lib/utils/slugify.ts
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
```
[ASSUMED -- standard approach for Spanish text slugification]

### Calling State Machine RPC
```typescript
// src/lib/actions/moderation-actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function approvePiece(productId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: product, error } = await supabase.rpc('transition_product_status', {
    p_product_id: productId,
    p_new_status: 'published',
    p_actor_id: user.id,
  })
  if (error) throw error

  // Send approval email (CATL-07)
  // await sendPieceApprovedEmail(product)

  // Revalidate affected pages (DISC-05)
  revalidatePath('/es/catalogo')
  revalidatePath(`/es/catalogo/${product.slug}`)

  return product
}
```
[VERIFIED: transition_product_status function exists in migration 008]

### Cloudinary Signed Upload API Route
```typescript
// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { z } from 'zod'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const UploadParamsSchema = z.object({
  folder: z.string().optional(),
  eager: z.string().optional(),
})

export async function POST(request: NextRequest) {
  // Auth check: only authenticated artisans/admins
  const body = await request.json()
  const params = UploadParamsSchema.parse(body)

  const timestamp = Math.round(Date.now() / 1000)
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder: params.folder, eager: params.eager },
    process.env.CLOUDINARY_API_SECRET!
  )

  return NextResponse.json({
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder: params.folder,
  })
}
```
[ASSUMED -- follows Cloudinary signed upload documentation pattern]

### ISR Revalidation Endpoint
```typescript
// src/app/api/revalidate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const RevalidateSchema = z.object({
  secret: z.string(),
  paths: z.array(z.string()).min(1),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { secret, paths } = RevalidateSchema.parse(body)

  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  paths.forEach((path) => revalidatePath(path))
  return NextResponse.json({ revalidated: true, paths })
}
```
[ASSUMED -- standard Next.js on-demand revalidation pattern]

### Filter Query Parameter Structure (Claude's Discretion)
```
/es/catalogo?tipo=anillo,collar&material=plata&precio_min=10000&precio_max=50000&ocasion=boda&tecnica=filigrana&pagina=1&orden=reciente
```
- Multiple values: comma-separated within a single param
- Price range: `precio_min` and `precio_max` as integers (CLP)
- Pagination: `pagina` (1-indexed)
- Sort: `orden` with values: `reciente` (default), `precio_asc`, `precio_desc`
- All params optional. Absence means "no filter applied"
[ASSUMED -- standard e-commerce URL pattern, matches UI-SPEC D-11]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| getServerSideProps / getStaticProps | App Router server components + searchParams | Next.js 13+ (2023) | Catalog page uses async server components directly |
| pages/api routes for mutations | Server actions ('use server') | Next.js 14 stable (2024) | Piece CRUD and moderation use server actions, not API routes |
| react-beautiful-dnd | @dnd-kit | 2023 (react-beautiful-dnd deprecated) | Use @dnd-kit for thumbnail reordering |
| next/image with blur placeholder | next/image with Cloudinary loader | Current | Cloudinary handles all transformations, next/image for lazy loading |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Deprecated, no React 18+ support. Use `@dnd-kit` instead. [VERIFIED: react-beautiful-dnd is archived on GitHub]
- `getServerSideProps`: Not used in App Router. Server components fetch data directly. [VERIFIED: Next.js 14 App Router]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Server actions (not API routes) are the right pattern for piece CRUD | Architecture Patterns | LOW -- API routes also work, but server actions are the App Router convention |
| A2 | Cloudinary signed upload via api_sign_request works as described | Code Examples | MEDIUM -- exact SDK API may differ; verify against Cloudinary v2 docs during implementation |
| A3 | @dnd-kit/utilities is needed alongside core+sortable | Standard Stack | LOW -- may just need core+sortable |
| A4 | Filter comma-separated URL params work well for Supabase .in() queries | Architecture Patterns | LOW -- standard pattern |
| A5 | Supabase nested select with !inner works for cover photo filtering | Code Examples | MEDIUM -- may need to adjust join syntax |

## Open Questions

1. **Seed data for categories and tags**
   - What we know: D-09 says categories and tags are seeded in migration. Tag types are: material, occasion, technique, style.
   - What's unclear: Exact list of initial categories and tags (e.g., which materials, which occasions). The ERD defines the schema but not the data.
   - Recommendation: Create a seed migration (012_seed_catalog.sql) with reasonable defaults. Ask user for the specific list during planning or use common jewelry categories (anillos, collares, pulseras, aretes, arte decorativo) and materials (plata 925, oro, cobre, bronce, piedras naturales).

2. **Admin moderation: viewing pending piece media via RLS**
   - What we know: product_media RLS policy allows SELECT only if product status IN ('published', 'sold'). Admin has FOR ALL policy.
   - What's unclear: When admin views a pending_review piece in moderation queue, do they hit the public SELECT policy or the admin FOR ALL policy?
   - Recommendation: Admin FOR ALL policy should take precedence (Supabase evaluates policies with OR logic). Verify during implementation that admin can see media for pending pieces.

3. **Auto-save draft persistence for wizard**
   - What we know: D-03 says auto-save on step advance. Product starts as draft.
   - What's unclear: How to handle step 2 (variants) and step 3 (photos) for a brand-new piece that hasn't been saved yet. Step 1 must create the product row first.
   - Recommendation: Step 1 "Siguiente" creates the product row (draft) and returns the product_id. Steps 2-4 all operate on that product_id. If user abandons after step 1, a draft row remains (acceptable -- artisan can delete or resume later).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v22.17.0 | -- |
| pnpm | Package manager | Yes | 10.33.0 | -- |
| Docker | Supabase local | Yes | 28.0.4 | -- |
| Supabase CLI | Migrations, type gen | Via npx/pnpm dlx | -- | pnpm dlx supabase |
| Cloudinary account | Media uploads | Configured via env | -- | -- |
| Resend account | Email sending | Configured via env | -- | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Supabase CLI not globally installed; use `pnpm dlx supabase` (already configured in package.json scripts).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.2 (unit) + Playwright 1.48.0 (E2E) |
| Config file | `vitest.config.ts` + `playwright.config.ts` |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test && pnpm test:e2e` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CATL-01 | Artisan creates piece with basic info | E2E | `pnpm test:e2e tests/e2e/piece-creation.spec.ts` | No -- Wave 0 |
| CATL-02 | Artisan creates variants | E2E | `pnpm test:e2e tests/e2e/piece-creation.spec.ts` | No -- Wave 0 |
| CATL-03 | Upload photos via Cloudinary | E2E | `pnpm test:e2e tests/e2e/piece-creation.spec.ts` | No -- Wave 0 |
| CATL-05 | Submit piece for review | E2E | `pnpm test:e2e tests/e2e/piece-creation.spec.ts` | No -- Wave 0 |
| CATL-06 | Admin approves/rejects piece | E2E | `pnpm test:e2e tests/e2e/moderation.spec.ts` | No -- Wave 0 |
| CATL-07 | Email sent on approval/rejection | Unit | `pnpm test -- moderation-actions` | No -- Wave 0 |
| DISC-01 | Public catalog loads with products | E2E | `pnpm test:e2e tests/e2e/catalog.spec.ts` | No -- Wave 0 |
| DISC-02 | Filters work on catalog | E2E | `pnpm test:e2e tests/e2e/catalog.spec.ts` | No -- Wave 0 |
| DISC-03 | Artisan profile page loads | E2E | `pnpm test:e2e tests/e2e/catalog.spec.ts` | No -- Wave 0 |
| DISC-04 | Product detail page loads | E2E | `pnpm test:e2e tests/e2e/catalog.spec.ts` | No -- Wave 0 |
| DISC-06 | SEO metadata present | Unit | `pnpm test -- metadata` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm lint && pnpm test`
- **Per wave merge:** `pnpm test && pnpm test:e2e`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/e2e/piece-creation.spec.ts` -- covers CATL-01 through CATL-05
- [ ] `tests/e2e/moderation.spec.ts` -- covers CATL-06, CATL-07
- [ ] `tests/e2e/catalog.spec.ts` -- covers DISC-01 through DISC-04, DISC-06
- [ ] `src/test/factories/product.ts` -- product + variant + media factories
- [ ] `src/test/factories/artisan.ts` -- artisan factory (may exist from Phase 1)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth + middleware session refresh (already implemented Phase 1) |
| V3 Session Management | Yes | Supabase cookie-based sessions (already implemented Phase 1) |
| V4 Access Control | Yes | RLS policies on all tables + layout auth guards + JWT role claims |
| V5 Input Validation | Yes | Zod schemas on all server actions and API routes |
| V6 Cryptography | No | Not applicable this phase (Cloudinary signing uses SDK, not custom crypto) |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized piece creation | Spoofing | RLS: artisan can only insert where artisan_id = current_artisan_id() |
| Direct status manipulation (skip review) | Tampering | transition_product_status RPC validates transitions; never UPDATE status directly |
| Cloudinary secret exposure | Information Disclosure | Signed upload via server-side /api/upload; secret never in client bundle |
| File upload abuse (malicious files, oversized) | Denial of Service | Cloudinary handles validation; DB trigger enforces 10-photo limit |
| IDOR on piece editing | Elevation of Privilege | RLS: artisan can only UPDATE where artisan_id = current_artisan_id() |
| Admin impersonation in moderation | Spoofing | RLS: admin policies check user_role() from JWT; middleware validates session |
| XSS via product title/description | Tampering | React auto-escapes JSX; Zod validates input length |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/004_catalog.sql` -- product, product_variant, product_media, category, tag schemas
- `supabase/migrations/008_state_machines.sql` -- transition_product_status function
- `supabase/migrations/010_rls.sql` -- All RLS policies for catalog tables
- `supabase/migrations/009_indexes.sql` -- Performance indexes
- `package.json` -- Current dependency versions
- `.planning/phases/02-catalog-discovery/02-CONTEXT.md` -- All user decisions
- `.planning/phases/02-catalog-discovery/02-UI-SPEC.md` -- UI design contract

### Secondary (MEDIUM confidence)
- npm registry -- Verified package versions (react-hook-form, @dnd-kit/*, lucide-react, etc.)
- Next.js 14 App Router documentation -- server actions, revalidatePath, generateMetadata patterns

### Tertiary (LOW confidence)
- Cloudinary signed upload flow -- Based on training data, needs verification against current SDK docs during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all core packages locked in package.json, new dependencies verified on npm
- Architecture: HIGH -- DB schema, RLS, state machine all exist and are well-defined
- Pitfalls: HIGH -- derived from concrete schema analysis and RLS policy review
- Cloudinary integration: MEDIUM -- SDK stub is empty, exact signing flow needs implementation-time verification

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable stack, no fast-moving dependencies)
