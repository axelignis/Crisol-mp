# Coding Conventions

**Analysis Date:** 2026-04-12

## Naming Patterns

**Files:**
- Components and lib utilities: `kebab-case.(ts|tsx)` (e.g., `product-card.tsx`, `stripe-split.ts`)
- Hooks: `use-*.ts` (e.g., `use-cart.ts`, `use-currency.ts`)
- API routes: `kebab-case` directories (e.g., `/api/couriers/quote`)
- Folders: `kebab-case` or `snake_case` for features (e.g., `src/components/catalog/`, `src/lib/utils/`)

**Functions and Variables:**
- `camelCase` for all function names and variables
- Examples: `createClient()`, `calculateSplit()`, `getProductBySlug()`, `handleSubmit()`

**Types and Interfaces:**
- `PascalCase` for all TypeScript types (auto-generated and custom)
- Examples: `Product`, `ProductWithMedia`, `OrderStatus`, `Database`

**Constants:**
- `UPPER_SNAKE_CASE` for module-level constants
- Examples: `MAX_PHOTOS_PER_PRODUCT`, `DEFAULT_LOCALE`, `SUPPORTED_CURRENCIES`
- Located in `src/lib/utils/constants.ts` (see `/Users/axelignis/crisol/src/lib/utils/constants.ts`)

**Database:**
- Table names: `snake_case` (e.g., `artisan`, `order_item`, `blog_post`)
- Column names: `snake_case` (e.g., `user_id`, `created_at`, `is_suspended`)
- Auto-generated in `src/types/database.types.ts` via `pnpm db:types` after migrations

**URLs and Slugs:**
- `kebab-case-sin-tildes` (no accents, no special chars)
- Example: `pendientes-plata-925` not `pendientes-plata-925` or `PENDIENTES_PLATA_925`

## Code Style

**Formatting:**
- No explicit `.prettierrc` file; Next.js ESLint config handles defaults
- Implicit formatting: 2-space indentation, single quotes for strings (Next.js defaults)

**Linting:**
- ESLint config: `.eslintrc.json` extends `next/core-web-vitals`
- See `/Users/axelignis/crisol/.eslintrc.json`
- Run with `pnpm lint`

**TypeScript:**
- Strict mode enabled: `"strict": true` in `tsconfig.json`
- Target: ES2022
- Module resolution: `bundler`
- See `/Users/axelignis/crisol/tsconfig.json`

## Import Organization

**Order:**
1. External libraries (`react`, `next`, `@supabase/...`, `stripe`, etc.)
2. Relative imports from `@/` alias
3. Type imports separate from value imports (TypeScript 5+)

**Path Aliases:**
- `@/` → `./src/` (configured in `tsconfig.json`)
- Use `@/` for all imports within `src/` directory

**Example Pattern:**
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'
```

## Error Handling

**Patterns:**
- API routes return `NextResponse` with appropriate HTTP status codes
- Server components use `notFound()` from `next/navigation` for 404s
- Use `redirect()` for auth guards and role-based redirects
- See `src/app/artesano/layout.tsx` and `src/app/[locale]/layout.tsx` for examples
- Async functions in layouts check auth via Supabase: `await supabase.auth.getUser()`

**Example Error Guard:**
```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/es/auth/login')

const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single()

if (profile?.role !== 'artisan' && profile?.role !== 'admin') {
  redirect('/es')
}
```

## Logging

**Framework:** `console` (no dedicated logging library detected)

**Patterns:**
- Use `console.log`, `console.error` as needed for development
- API routes use `console.error` for webhook/integration issues
- No structured logging or log levels detected in current codebase

## Comments

**When to Comment:**
- Business logic requiring explanation (e.g., split payment calculation rules)
- References to external docs (Stripe splits, RLS policies)
- Non-obvious type assertions or type guards

**JSDoc/TSDoc:**
- Not enforced by linting; optional for exported functions
- Use for complex utility functions and hooks that expose reusable logic

## Function Design

**Size:** 
- Keep functions under 50 lines when possible
- Separate complex logic into smaller utility functions
- Server components can be longer due to async setup

**Parameters:**
- Use object parameters for functions with 3+ arguments (avoid positional param hell)
- Example: `calculateSplit(amount, commissionPercent)` vs `calculateSplit({ amount, percentage })`

**Return Values:**
- Async functions in Server Components return JSX or void
- Utility functions return typed values (use `as const` for literal types)
- Example: `PRODUCT_STATUSES.DRAFT as const` for status literals

## Module Design

**Exports:**
- Named exports preferred over default exports
- Example: `export function ProductCard()` not `export default ProductCard`

**Barrel Files:**
- Used in `src/types/index.ts` for re-exporting
- Typically not used in `src/lib/` to keep imports explicit

**File Responsibilities:**
- One main export per file (exceptions: barrel files, UI primitives)
- Supabase clients in separate files: `client.ts` (CSR), `server.ts` (SSR), `middleware.ts` (Edge)

## Type Organization

**Database Types:**
- Auto-generated from migrations: `src/types/database.types.ts`
- Never edit manually — regenerate with `pnpm db:types` after migrations
- Example structure: `Database['public']['Tables']['product']['Row']`

**API Types:**
- Custom request/response types in `src/types/api.types.ts`
- Use for Stripe webhook payloads, Cloudinary responses, etc.

**Constants as Types:**
- Use `as const` for constant objects to enable literal type inference
- Example: `export const PRODUCT_STATUSES = { ... } as const`
- Then: `type ProductStatus = typeof PRODUCT_STATUSES[keyof typeof PRODUCT_STATUSES]`

## Async/Await Patterns

**Server Components:**
- Mark with `async` keyword
- Await Supabase calls and data fetching directly
- Return JSX or redirect/notFound

**API Routes:**
- Export async functions: `export async function GET(request: Request) { ... }`
- Always return `NextResponse.json()` or `NextResponse` with status code

**Zod Validation:**
- All external input (API routes, webhooks, server actions) validated with Zod
- Example: Define schema, call `.parse()` or `.safeParse()` on request body
- Not yet visible in scaffolded code but required per CLAUDE.md

## Environment Variables

**Accessible on Client:**
- Prefix with `NEXT_PUBLIC_` only (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
- See `src/lib/supabase/server.ts` using `process.env.NEXT_PUBLIC_SUPABASE_URL`

**Server-Only:**
- No prefix: `SUPABASE_SERVICE_ROLE`, `STRIPE_SECRET_KEY`, `WEBHOOK_SECRET`
- Never expose in client bundles or import from CSR

**Secrets:**
- Webhook secrets, API keys, service role keys never logged or exposed
- Use `.env.local` locally (not committed)
- Use Vercel env vars in production

## Next.js Patterns

**Middleware:**
- Located at `middleware.ts` in project root
- Handles i18n routing and session refresh
- See `/Users/axelignis/crisol/middleware.ts`

**Server Components (Default):**
- All components are Server Components by default in Next.js 14 App Router
- Mark Client Components with `'use client'` at top of file

**Layouts:**
- Recursive; inherited by child routes
- Use for shared UI (header, sidebar, auth guards)
- Auth-guard layouts in `src/app/artesano/layout.tsx` and `src/app/admin/layout.tsx`

**Route Groups:**
- Use `(name)` syntax to group routes without affecting URL structure
- Example: `src/app/[locale]/(seo)/` for SEO pages that don't add URL segment

## Rendering Strategy

**SSG (Static Site Generation):**
- Blog, FAQ, Glosario pages: pre-generate at build time
- Use `generateStaticParams()` for dynamic routes

**ISR (Incremental Static Regeneration):**
- Catalog, product detail, artisan profiles: regenerate on-demand when published
- Use `revalidate` on-demand via `/api/revalidate` webhook trigger

**SSR (Server-Side Rendering):**
- Checkout, user panels (cuenta, artesano, admin): fetch fresh data per request
- Required for auth-dependent and personalized content

**CSR (Client-Side Rendering):**
- Carrito (shopping cart): managed by Zustand in browser
- Filters and real-time interactions

---

*Convention analysis: 2026-04-12*
