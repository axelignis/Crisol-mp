# Phase 2: Catalog & Discovery - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Artisans can create and manage pieces with variants and media, admins can moderate submissions, and visitors can browse a public catalog with filtering, product detail, and artisan profiles. Categories and tags are seeded in migrations (no admin CRUD this phase).

</domain>

<decisions>
## Implementation Decisions

### Piece Creation Form
- **D-01:** Wizard multi-paso de 4 pasos: (1) Info básica (título, tipo, descripción, precio), (2) Variantes, (3) Fotos, (4) Revisar y enviar
- **D-02:** Mismo formulario para todos los tipos de pieza (única, serie, arte decorativo) con campos condicionales según tipo — serie muestra stock, única fija stock=1, arte decorativo puede omitir talla
- **D-03:** Auto-save por paso — cada vez que el artesano avanza de paso se guarda automáticamente como draft. Puede salir y volver donde quedó.

### Media Upload
- **D-04:** Drag & drop zone con thumbnails reordenables. Primera foto = portada por defecto, click para cambiar portada. Preview instantáneo antes de subir a Cloudinary.

### Variants Management
- **D-05:** Tabla editable inline en paso 2 del wizard. Columnas: tipo (talla/material/color/piedras), valor, stock, modificador de precio (+/- CLP). Botón + para agregar fila.

### Piece Editing
- **D-06:** Ediciones de piezas publicadas se publican directamente sin re-aprobación. Modelo familiar — admin confía en los artesanos. (Cumple CATL-11 en su forma más permisiva.)

### Admin Moderation
- **D-07:** Cola de revisión con layout lista + panel lateral: lista de piezas pendientes a la izquierda, click abre panel derecho con detalle completo (fotos, variantes, info artesano). Acciones: Aprobar, Pedir cambios, Rechazar.
- **D-08:** Feedback al artesano vía mensaje de texto libre del admin. Artesano ve el mensaje en su panel junto a la pieza en estado changes_requested.

### Categories & Tags
- **D-09:** Categorías y tags se seedean en la migración (datos iniciales). CRUD de categorías/tags desde admin se difiere a Phase 5 (Dashboards & Operations).

### Public Catalog
- **D-10:** Grid responsivo: 2 columnas móvil, 3 tablet, 4 desktop. Cards con foto portada, título, nombre artesano, precio en CLP.
- **D-11:** Sidebar de filtros a la izquierda: tipo de pieza, material, rango de precio (slider), ocasión, técnica. En móvil colapsa a botón "Filtros" que abre sheet (sheet.tsx ya existe).
- **D-12:** Lógica de filtros: OR dentro de un mismo filtro (Plata O Oro), AND entre filtros distintos (Material AND Tipo). Estándar e-commerce.
- **D-13:** Paginación clásica numerada al fondo. 12-24 piezas por página. Compatible con SSG/ISR y SEO (Google indexa cada página).

### Product Detail
- **D-14:** Galería con foto principal grande + fila de thumbnails abajo. Click en thumbnail cambia principal. Click en principal abre lightbox fullscreen.
- **D-15:** Selector de variantes con botones tipo chip/pill agrupados por tipo. Selección actualiza precio dinámicamente. Stock bajo muestra badge "Quedan N unidades".

### Artisan Profile
- **D-16:** Header con foto, nombre, bio y redes sociales. Debajo: grid de sus piezas publicadas (mismo estilo catálogo). Simple y centrado en el trabajo.

### Claude's Discretion
- SEO metadata y JSON-LD specifics (generateMetadata implementation)
- Exact sort/order options for catalog (relevancia, precio, fecha)
- Empty states design (catálogo sin resultados, artesano sin piezas)
- Product viewer 3D integration details (product-viewer-3d.tsx exists)
- Sold pieces display in artisan portfolio (badge "Vendida" overlay)
- Lightbox implementation approach
- Filter URL query parameter structure
- Notification email templates for piece approval/rejection (CATL-07)
- ISR revalidation trigger implementation (DISC-05, route exists)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database & Schema
- `docs/erd_core.html` — Full 22-entity ERD: product, product_variant, product_media, category, tag tables with relationships and constraints

### Publication Flow
- `docs/flow_publication.html` — Product state machine: draft → pending_review → published (+ changes_requested, rejected, sold)

### Architecture
- `docs/architecture.html` — System architecture, Supabase integration patterns, ISR/SSG strategy, Cloudinary pipeline

### API
- `docs/api_spec.html` — API endpoints including /api/upload (Cloudinary signed upload) and /api/revalidate (ISR trigger)

### Project Structure
- `docs/project_structure.md` — Directory layout, naming conventions, component organization

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/catalog/product-card.tsx` — Product card scaffold (needs implementation)
- `src/components/catalog/product-grid.tsx` — Grid scaffold (needs responsive columns)
- `src/components/catalog/product-filters.tsx` — Filters scaffold (needs sidebar + mobile sheet)
- `src/components/catalog/product-gallery.tsx` — Gallery scaffold (needs thumbnail nav + lightbox)
- `src/components/catalog/product-viewer-3d.tsx` — 3D viewer scaffold (Google Model Viewer)
- `src/components/artisan/artisan-card.tsx` — Artisan card scaffold
- `src/components/artisan/artisan-profile-header.tsx` — Profile header scaffold
- `src/components/ui/sheet.tsx` — Sheet component for mobile filter overlay
- `src/components/ui/skeleton.tsx` — Loading skeletons
- `src/components/ui/badge.tsx` — Badge for stock/status indicators
- `src/components/ui/select.tsx` — Select for sort dropdown
- `src/lib/cloudinary/client.ts` + `upload.ts` — Cloudinary SDK integration
- `src/app/api/upload/route.ts` — Signed upload endpoint
- `src/app/api/revalidate/route.ts` — ISR revalidation endpoint
- `src/lib/utils/constants.ts` — PRODUCT_STATUSES already defined

### Established Patterns
- Supabase Auth with cookie-based sessions via `@supabase/ssr`
- Layout-level auth guards (server component, redirect on unauthorized)
- next-intl for i18n (es default, en)
- Zustand stores for client state (cart, currency)
- TypeScript strict mode, path alias `@/` → `src/`

### Integration Points
- `src/app/artesano/` — Artisan dashboard (auth-guarded layout exists from Phase 1)
- `src/app/admin/` — Admin panel (auth-guarded layout exists from Phase 1)
- `src/app/[locale]/` — Public routes for catalog, product detail, artisan profile
- `middleware.ts` — i18n + session refresh already wired
- `src/types/database.types.ts` — Auto-generated types (regenerate after Phase 1 migrations)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for implementation details.

</specifics>

<deferred>
## Deferred Ideas

- CRUD de categorías/tags desde admin panel — Phase 5 (Dashboards & Operations)

</deferred>

---

*Phase: 02-catalog-discovery*
*Context gathered: 2026-04-12*
