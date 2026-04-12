# Codebase Structure

**Analysis Date:** 2026-04-12

## Directory Layout

```
crisol/
├── .claude/                        # GSD framework files (tooling)
├── .github/                        # CI/CD workflows
├── docs/                           # Architecture documentation (HTML + Markdown)
├── messages/                       # i18n JSON files (es.json, en.json)
├── node_modules/                  # Dependencies (ignored)
├── public/                         # Static assets (favicon, robots.txt, llms.txt, icons/)
├── src/
│   ├── app/                       # Next.js App Router routes & layouts
│   ├── components/                # React components organized by feature
│   ├── hooks/                     # Custom React hooks (Zustand, Supabase)
│   ├── i18n/                      # Internationalization config & request handler
│   ├── lib/                       # Business logic, utilities, SDKs
│   ├── store/                     # Global state stores (Zustand)
│   └── types/                     # TypeScript type definitions
├── tests/                         # E2E tests (Playwright)
├── middleware.ts                  # Edge middleware (i18n + auth session refresh)
├── next.config.mjs                # Next.js configuration
├── tailwind.config.ts             # Tailwind CSS theming
├── tsconfig.json                  # TypeScript compiler options
└── package.json                   # Dependencies & scripts
```

## Directory Purposes

**src/app/:**
- Purpose: Next.js App Router routes (page, layout, API handlers)
- Contains: Nested folders representing URL segments, page.tsx/layout.tsx files, API route handlers
- Key subdirectories:
  - `[locale]/`: Public marketplace routes (es, en localized)
  - `artesano/`: Artisan dashboard (auth-guarded, non-localized)
  - `admin/`: Admin panel (auth-guarded, non-localized)
  - `api/`: Route handlers for integrations and webhooks

**src/components/:**
- Purpose: Reusable UI components organized by feature domain
- Contains: Presentational components (TSX), UI primitives, feature-specific component groups
- Structure:
  - `ui/`: Radix-inspired primitives (button, input, dialog, sheet, badge, select, skeleton, toast)
  - `catalog/`: Product display (product-card, product-grid, product-filters, product-gallery, product-viewer-3d)
  - `cart/`: Shopping cart UI (cart-sheet, cart-item)
  - `checkout/`: Payment flow (checkout-form, payment-stripe, payment-crypto, order-summary)
  - `artisan/`: Artisan-related cards (artisan-card, artisan-profile-header)
  - `loyalty/`: Membership system (points-display, membership-badge, points-redeem)
  - `seo/`: Structured data helpers (structured-data, breadcrumb)
  - `layout/`: App chrome (header, footer, locale-switcher, currency-switcher)

**src/hooks/:**
- Purpose: Custom React hooks for state and data fetching
- Contains: Zustand integration hooks, Supabase hooks, composition patterns
- Files:
  - `use-cart.ts`: Cart state hook
  - `use-wishlist.ts`: Wishlist/favorites hook
  - `use-currency.ts`: Active currency (CLP/USD) hook
  - `use-notifications.ts`: Notification subscription hook

**src/i18n/:**
- Purpose: Internationalization setup and request-level locale handling
- Contains: Routing configuration, message loading, locale validation
- Files:
  - `routing.ts`: `defineRouting` with supported locales (es, en) and default (es)
  - `request.ts`: `getRequestConfig` async loader for messages JSON per request

**src/lib/:**
- Purpose: Shared utilities, SDKs, business logic organized by domain
- Subdirectories:
  - `supabase/`: Database & auth client factories
    - `server.ts`: SSR/RSC context client with cookie handling
    - `client.ts`: Browser context client
    - `middleware.ts`: Session refresh handler
  - `stripe/`: Payment processing
    - `client.ts`: Stripe SDK instance
    - `split.ts`: Split payment + transfer logic
  - `cloudinary/`: Image management
    - `client.ts`: Cloudinary SDK config
    - `upload.ts`: Signature generation for client-side uploads
  - `couriers/`: Shipping providers
    - `index.ts`: Unified quote interface
    - `chilexpress.ts`, `starken.ts`, `dhl.ts`, `fedex.ts`: Provider implementations
  - `resend/`: Email service
    - `client.ts`: Resend SDK instance
    - `templates/`: React Email components (order-confirmed, order-shipped, order-delivered, piece-approved, piece-rejected, artisan-new-piece)
  - `seo/`: SEO utilities
    - `metadata.ts`: `generateMetadata` helpers
    - `schema.ts`: JSON-LD builders (Product, FAQPage, Breadcrumb)
    - `sitemap.ts`: Sitemap generation helpers
  - `utils/`: Pure utility functions
    - `constants.ts`: Global constants (MAX_PHOTOS_PER_PRODUCT, statuses, roles)
    - `currency.ts`: CLP ↔ USD conversion
    - `format.ts`: Price/date formatting
    - `slugify.ts`: URL slug generation with unaccent
    - `commission.ts`: Artisan payment calculation

**src/store/:**
- Purpose: Global client-side state (Zustand stores)
- Contains: Store definitions, state shape, actions
- Files:
  - `cart.store.ts`: Cart items, totals
  - `currency.store.ts`: Selected currency (CLP/USD)

**src/types/:**
- Purpose: TypeScript type definitions
- Contains: Auto-generated DB types, API request/response shapes, business domain types
- Files:
  - `database.types.ts`: Auto-generated by Supabase CLI (do not edit manually)
  - `api.types.ts`: Request/response types for API routes
  - `index.ts`: Re-exports and business domain types

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout (sets metadata, imports globals.css)
- `src/app/[locale]/layout.tsx`: Locale layout (wraps with NextIntlClientProvider, validates locale)
- `src/app/[locale]/page.tsx`: Home page
- `src/app/artesano/layout.tsx`: Artisan dashboard entry (auth guard: role = artisan or admin)
- `src/app/admin/layout.tsx`: Admin panel entry (auth guard: role = admin only)
- `middleware.ts`: Edge middleware (session refresh + i18n routing)

**Configuration:**
- `next.config.mjs`: Next.js config (next-intl plugin, Cloudinary remote patterns, model-viewer optimization)
- `tsconfig.json`: TypeScript compiler (strict mode, path alias `@/` → `src/`)
- `tailwind.config.ts`: Tailwind theming
- `messages/es.json`: Spanish translations
- `messages/en.json`: English translations
- `.env.local`: Local environment variables (not committed)

**Core Logic:**
- `src/lib/supabase/server.ts`: Server-side Supabase client factory
- `src/lib/supabase/client.ts`: Browser-side Supabase client factory
- `src/lib/stripe/split.ts`: Commission & split payment calculation
- `src/lib/utils/commission.ts`: Artisan payout formula
- `src/lib/utils/constants.ts`: Global constants (product states, order states, roles, locales, currencies)

**Testing:**
- `tests/e2e/`: Playwright E2E test files (not yet implemented)
- `vitest.config.ts`: Vitest unit test config (if exists)

## Naming Conventions

**Files:**
- Components: `kebab-case.tsx` — `product-card.tsx`, `cart-sheet.tsx`
- Hooks: `use-*.ts` — `use-cart.ts`, `use-currency.ts`
- Utilities/Libraries: `kebab-case.ts` — `currency-conversion.ts`, `commission.ts`
- Config files: `lowercase.ext` or `camelCase` — `next.config.mjs`, `tsconfig.json`

**Directories:**
- Feature-based: `lowercase` — `catalog/`, `checkout/`, `artisan/`, `loyalty/`
- Utility groups: `lowercase` — `lib/utils/`, `lib/supabase/`, `lib/stripe/`

**Types/Interfaces:**
- `PascalCase` — `ProductWithMedia`, `OrderStatus`, `ArtisanProfile`

**Functions/Variables:**
- `camelCase` — `calculateCommission()`, `formatPrice()`, `createClient()`

**Constants:**
- `UPPER_SNAKE_CASE` — `MAX_PHOTOS_PER_PRODUCT`, `DEFAULT_LOCALE`, `PRODUCT_STATUSES`

**Route Segments/Slugs:**
- URL-safe kebab-case without accents — `/catalogo/`, `/artesanos/`, `/cuenta/` (routes)
- Product/artisan slugs: `pendientes-plata-925` (derived from name via `slugify()`)

## Where to Add New Code

**New Feature (e.g., Reviews):**
- Page/route: `src/app/[locale]/resenas/` or `src/app/artesano/resenas/`
- Components: `src/components/reviews/` (review-list.tsx, review-form.tsx, review-card.tsx)
- Hooks: `src/hooks/use-reviews.ts` (if state needed)
- API route: `src/app/api/reviews/route.ts` (if backend integration)
- Tests: `tests/e2e/reviews.spec.ts`

**New Component (UI or Feature):**
- Implementation: `src/components/{feature}/component-name.tsx`
- Export from feature barrel (if multiple components): `src/components/{feature}/index.ts`
- If hooks needed: `src/hooks/use-component-name.ts` at root level

**New Utility Function:**
- General helpers: `src/lib/utils/new-helper.ts`
- Domain-specific: `src/lib/{domain}/new-function.ts` (e.g., `src/lib/stripe/new-payment-method.ts`)
- Always prefer `kebab-case` filenames

**New Supabase Migration:**
- File: `supabase/migrations/YYYYMMDDHHMM_description.sql`
- After applying: run `pnpm db:types` to regenerate `src/types/database.types.ts`

**New API Route (Integration):**
- File: `src/app/api/{resource}/{action}/route.ts` (e.g., `src/app/api/coupons/validate/route.ts`)
- Handler signature: `export async function POST(request: Request) { ... }`
- Always validate input with Zod before processing
- Return `NextResponse.json()` with error handling

**New Email Template:**
- File: `src/lib/resend/templates/event-name.tsx`
- Pattern: React component exporting JSX, imported and sent via `client.emails.send()`

**New Server Action:**
- If exists in codebase: add to `src/app/[route]/actions.ts` near related page
- Pattern: `'use server'` directive at top, Zod validation, try-catch, return typed response
- Client invocation: `const result = await actionFunction(data)`

## Special Directories

**public/:**
- Purpose: Static assets served directly by Next.js
- Generated: No
- Committed: Yes
- Contents: favicon, robots.txt, llms.txt, icons/
- Note: Ignore `.env*` files despite being root-level

**messages/:**
- Purpose: next-intl translation JSON files
- Generated: No (maintained manually)
- Committed: Yes
- Structure: `messages/{locale}.json` (es.json required, en.json optional but must have structure)

**.planning/codebase/:**
- Purpose: GSD framework documentation (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: No (written by Claude agents)
- Committed: Yes
- Contents: Analysis documents describing codebase patterns

**tests/e2e/:**
- Purpose: Playwright E2E test specifications
- Generated: No (written by developers)
- Committed: Yes
- Pattern: `tests/e2e/{feature}.spec.ts`
- Run: `pnpm test:e2e`

**supabase/migrations/:**
- Purpose: Forward-only SQL migrations
- Generated: No (created via `supabase migration new {name}`)
- Committed: Yes
- Rule: Never edit applied migrations; create new ones for changes
- After each: run `pnpm db:types` to sync TypeScript types

**src/types/database.types.ts:**
- Purpose: Supabase schema types (auto-generated)
- Generated: Yes (via `supabase gen types typescript ...`)
- Committed: Yes (snapshot of current schema)
- Rule: Do not edit manually; regenerate after every migration

**.next/:**
- Purpose: Next.js build cache and output
- Generated: Yes (during `pnpm build`)
- Committed: No (.gitignored)

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (via `pnpm install`)
- Committed: No (.gitignored)

---

*Structure analysis: 2026-04-12*
