# Crisol

Marketplace de orfebrería artesanal. Para contexto profundo leer `docs/` (architecture, api_spec, erd_core, flow_*, project_structure, testing_strategy).

## Stack

Next.js App Router · TypeScript · Tailwind · next-intl (`es` default, `en`) · Zustand · Zod · Supabase (Postgres + Auth + Storage + RLS) · Stripe Connect (split payment) · Coinbase Commerce · Cloudinary · Resend + React Email · Couriers: Chilexpress, Starken, DHL, FedEx · Lighthouse CI · pnpm.

## Comandos

```bash
pnpm install | pnpm dev | pnpm build | pnpm start | pnpm lint | pnpm test
pnpm db:types                 # regenerar src/types/database.types.ts
supabase start | supabase migration new <nombre>
```

## Convenciones

- Archivos componente/lib: `kebab-case.(ts|tsx)`. Hooks: `use-*.ts`.
- TS: tipos `PascalCase`, funciones/vars `camelCase`, constantes `UPPER_SNAKE_CASE`.
- BD: tablas y columnas `snake_case`. Slugs URL: `kebab-case` sin tildes.
- Alias de import: `@/` → `src/`.

## Reglas de negocio

- RLS activo en toda tabla; `service_role key` solo server-side.
- Roles: `admin`, `artisan`, `buyer`. Layouts `/artesano` y `/admin` auth-guarded por rol.
- Estados de pieza: `draft → pending_review → published` (+ `changes_requested`, `rejected`, `sold`). Solo `published` es público.
- Estados de pedido: `pending_payment → paid → in_preparation → shipped → delivered` (+ `cancelled`). No saltar estados.
- Split payment: usar `lib/utils/commission.ts` con el % vigente en `config`. Nunca hardcodear comisión.
- Webhooks Stripe/Coinbase: verificar firma e idempotencia por `event.id`.
- Precios canónicos en **CLP**; USD es display-only vía `/api/currency`, no persistir.
- Input externo (API routes, server actions, webhooks) siempre validado con Zod.
- Uploads de media solo vía firma Cloudinary desde `/api/upload`. Respetar `MAX_PHOTOS_PER_PRODUCT`.
- Cambios en pieza/artesano/blog disparan revalidate on-demand con `REVALIDATE_SECRET`.
- Páginas públicas: `generateMetadata` + JSON-LD cuando aplique. Preservar `robots.txt` y `llms.txt`.
- Solo variables `NEXT_PUBLIC_*` llegan al cliente. Nunca exponer service_role, secret keys, webhook secrets, API keys de couriers ni `CRON_SECRET`.
- Migraciones forward-only y numeradas en `supabase/migrations/`. No editar migraciones aplicadas.
- `src/types/database.types.ts` es autogenerado; regenerar tras cada migración, no editar a mano.
- Locale `es` obligatorio; `en` puede estar incompleto pero su estructura debe existir.

## Git

- Ramas protegidas (nunca commitear directo): `main`, `develop`, `qa`, `uat`.
- Branching: `feature/*`, `fix/*`, `chore/*`, `hotfix/*` desde `develop`.
- Hotfixes críticos de producción: desde `main`, merge back a `main` + `develop`.
- Flujo: `feature/*` → `develop` → `qa` → `uat` → `main`.
- Formato de commit: `type(scope): descripción` — types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.
- Siempre mostrar el comando (en una sola linea) de push para que el usuario lo ejecute. Nunca hacer push ni merge.

## Testing

- Todo feature nuevo requiere tests E2E en Playwright antes de cerrar la rama.
- Archivos en `tests/e2e/<feature>.spec.ts`.
- Correr con `pnpm test:e2e` y confirmar que pasan antes de hacer commit final.
- Los tests deben cubrir el happy path completo y al menos un caso de error.
- Datos de prueba: usar factories de `src/test/factories/`, nunca datos hardcodeados.

## Instrucciones de respuesta

- Brevedad extrema: Usa solo frases de 3 a 6 palabras.
- Sin rellenos: Prohibido decir "Entiendo", "Aquí tienes el código" o "Espero que esto ayude".
- Prioridad técnica: Primero la herramienta o el código, luego el resultado, y solo si es crítico, una explicación mínima.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Crisol**

Crisol es un marketplace e-commerce multivvendedor de joyería artesanal, orfebrería y arte decorativo elaborado por miembros de una familia. Opera bajo marca híbrida: identidad unificada Crisol con perfiles de autor visibles por artesano. El administrador (desarrollador del sistema) percibe comisión fija automática por cada venta vía Stripe Connect.

**Core Value:** Un comprador puede descubrir, explorar y comprar piezas artesanales únicas con pago seguro y despacho directo del artesano — el flujo compra completa → split payment → despacho debe funcionar sin fricción.

### Constraints

- **Tech stack**: Next.js 14 App Router + Supabase + Stripe Connect + Cloudinary + Resend — decidido (ADR-001 a ADR-004)
- **Security**: RLS activo en toda tabla; service_role key solo server-side. Pagos PCI-compliant vía Stripe.
- **Data model**: USER como tabla base única para todos los roles (ADR-005). SEO_META polimórfica (ADR-006).
- **i18n**: next-intl con es default. Locale es obligatorio; en puede estar incompleto pero su estructura debe existir.
- **Media**: Uploads solo vía firma Cloudinary desde /api/upload. Máximo 10 fotos por producto.
- **Webhooks**: Stripe/Coinbase deben verificar firma e idempotencia por event.id.
- **Commission**: Usar lib/utils/commission.ts con % vigente en config. Nunca hardcodear.
- **State machine**: Estados de pieza y pedido son estrictos — no saltar estados.
- **Git**: Ramas protegidas (main, develop, qa, uat). Feature branches desde develop.
- **Testing**: Todo feature nuevo requiere tests E2E en Playwright.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.6.2 - Application code, type-safe React components, API routes
- JavaScript (JSX/TSX) - React components, Next.js configuration
- SQL - Supabase database migrations and schema
- TOML - Supabase configuration (`supabase/config.toml`)
## Runtime
- Node.js (via pnpm package manager)
- Next.js 14.2.15 (App Router)
- pnpm - Monorepo support, fast lockfile
- Lockfile: `pnpm-lock.yaml` (present)
## Frameworks
- Next.js 14.2.15 - React framework with App Router, server actions, middleware, built-in optimizations
- React 18.3.1 - UI library
- React DOM 18.3.1 - React web binding
- next-intl 3.20.0 - Multi-language support (Spanish `es` default, English `en`)
- Plugin: `src/i18n/request.ts`
- Tailwind CSS 3.4.13 - Utility-first CSS framework
- PostCSS 8.4.47 - CSS processing
- Autoprefixer 10.4.20 - Vendor prefixes
- Zustand 4.5.5 - Lightweight state management (`src/store/`)
- Vitest 2.1.2 - Unit/integration test runner
- Playwright 1.48.0 - E2E testing framework
- Config: `playwright.config.ts`, test files in `tests/e2e/`
- Next.js built-in bundler and dev server
- TypeScript compiler (strict mode enabled)
- ESLint 8.57.1 - Linting (via eslintrc.json)
- next-sitemap 4.2.3 - Sitemap generation
- Lighthouse CI (@lhci/cli 0.14.0) - Performance monitoring
- Config: `lighthouserc.js`
## Key Dependencies
- @supabase/supabase-js 2.45.4 - Supabase client SDK for database, auth, storage
- @supabase/ssr 0.5.1 - Server-side rendering support with Supabase Auth
- stripe 17.1.0 - Stripe server-side SDK for payment processing and Connect
- @stripe/stripe-js 4.6.0 - Stripe.js client library for payment collection
- @stripe/react-stripe-js 2.8.0 - React components for Stripe integration
- cloudinary 2.5.1 - CDN and image transformation service SDK
- resend 4.0.0 - Transactional email service SDK
- @react-email/components 0.0.25 - React component email templates
- zod 3.23.8 - TypeScript-first schema validation (API input validation)
- @types/node 20.16.11 - Node.js type definitions
- @types/react 18.3.11 - React type definitions
- @types/react-dom 18.3.0 - React DOM type definitions
## Configuration
- Configured via `.env.local` (local development) and Vercel environment variables (production)
- Environment file example: `crisol.env.example` (with inline documentation)
- Variables organized by service: Supabase, Stripe, Coinbase, Cloudinary, Resend, couriers, Google APIs
- NEXT_PUBLIC_* pattern used for client-side variables (URL, keys safe with RLS/CORS)
- Server-side secrets: service keys, API secrets, webhook secrets (never exposed to client)
- `next.config.mjs` - Next.js configuration (Cloudinary image remotePatterns, next-intl plugin, optional Google Model Viewer)
- `tsconfig.json` - TypeScript compiler options (strict mode, ES2022 target, path aliases `@/*` → `src/*`)
- `tailwind.config.ts` - Tailwind configuration (app and components directories)
- `postcss.config.js` - PostCSS pipeline (Tailwind, autoprefixer)
- `middleware.ts` - Next.js middleware (locale routing with next-intl, potentially Supabase session refresh)
- `supabase/config.toml` - Supabase local development configuration
## Platform Requirements
- Node.js (for pnpm)
- Supabase CLI (for `supabase start`, database migrations, type generation)
- PostgreSQL 17 (via Supabase local)
- Playwright browsers (for E2E tests)
- Vercel (default Next.js hosting platform)
- Supabase project (cloud-hosted PostgreSQL, Auth, Storage, Realtime)
- Stripe account with Connect enabled
- Cloudinary account for CDN
- Resend account for transactional emails
## Key Scripts
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Components and lib utilities: `kebab-case.(ts|tsx)` (e.g., `product-card.tsx`, `stripe-split.ts`)
- Hooks: `use-*.ts` (e.g., `use-cart.ts`, `use-currency.ts`)
- API routes: `kebab-case` directories (e.g., `/api/couriers/quote`)
- Folders: `kebab-case` or `snake_case` for features (e.g., `src/components/catalog/`, `src/lib/utils/`)
- `camelCase` for all function names and variables
- Examples: `createClient()`, `calculateSplit()`, `getProductBySlug()`, `handleSubmit()`
- `PascalCase` for all TypeScript types (auto-generated and custom)
- Examples: `Product`, `ProductWithMedia`, `OrderStatus`, `Database`
- `UPPER_SNAKE_CASE` for module-level constants
- Examples: `MAX_PHOTOS_PER_PRODUCT`, `DEFAULT_LOCALE`, `SUPPORTED_CURRENCIES`
- Located in `src/lib/utils/constants.ts` (see `/Users/axelignis/crisol/src/lib/utils/constants.ts`)
- Table names: `snake_case` (e.g., `artisan`, `order_item`, `blog_post`)
- Column names: `snake_case` (e.g., `user_id`, `created_at`, `is_suspended`)
- Auto-generated in `src/types/database.types.ts` via `pnpm db:types` after migrations
- `kebab-case-sin-tildes` (no accents, no special chars)
- Example: `pendientes-plata-925` not `pendientes-plata-925` or `PENDIENTES_PLATA_925`
## Code Style
- No explicit `.prettierrc` file; Next.js ESLint config handles defaults
- Implicit formatting: 2-space indentation, single quotes for strings (Next.js defaults)
- ESLint config: `.eslintrc.json` extends `next/core-web-vitals`
- See `/Users/axelignis/crisol/.eslintrc.json`
- Run with `pnpm lint`
- Strict mode enabled: `"strict": true` in `tsconfig.json`
- Target: ES2022
- Module resolution: `bundler`
- See `/Users/axelignis/crisol/tsconfig.json`
## Import Organization
- `@/` → `./src/` (configured in `tsconfig.json`)
- Use `@/` for all imports within `src/` directory
## Error Handling
- API routes return `NextResponse` with appropriate HTTP status codes
- Server components use `notFound()` from `next/navigation` for 404s
- Use `redirect()` for auth guards and role-based redirects
- See `src/app/artesano/layout.tsx` and `src/app/[locale]/layout.tsx` for examples
- Async functions in layouts check auth via Supabase: `await supabase.auth.getUser()`
## Logging
- Use `console.log`, `console.error` as needed for development
- API routes use `console.error` for webhook/integration issues
- No structured logging or log levels detected in current codebase
## Comments
- Business logic requiring explanation (e.g., split payment calculation rules)
- References to external docs (Stripe splits, RLS policies)
- Non-obvious type assertions or type guards
- Not enforced by linting; optional for exported functions
- Use for complex utility functions and hooks that expose reusable logic
## Function Design
- Keep functions under 50 lines when possible
- Separate complex logic into smaller utility functions
- Server components can be longer due to async setup
- Use object parameters for functions with 3+ arguments (avoid positional param hell)
- Example: `calculateSplit(amount, commissionPercent)` vs `calculateSplit({ amount, percentage })`
- Async functions in Server Components return JSX or void
- Utility functions return typed values (use `as const` for literal types)
- Example: `PRODUCT_STATUSES.DRAFT as const` for status literals
## Module Design
- Named exports preferred over default exports
- Example: `export function ProductCard()` not `export default ProductCard`
- Used in `src/types/index.ts` for re-exporting
- Typically not used in `src/lib/` to keep imports explicit
- One main export per file (exceptions: barrel files, UI primitives)
- Supabase clients in separate files: `client.ts` (CSR), `server.ts` (SSR), `middleware.ts` (Edge)
## Type Organization
- Auto-generated from migrations: `src/types/database.types.ts`
- Never edit manually — regenerate with `pnpm db:types` after migrations
- Example structure: `Database['public']['Tables']['product']['Row']`
- Custom request/response types in `src/types/api.types.ts`
- Use for Stripe webhook payloads, Cloudinary responses, etc.
- Use `as const` for constant objects to enable literal type inference
- Example: `export const PRODUCT_STATUSES = { ... } as const`
- Then: `type ProductStatus = typeof PRODUCT_STATUSES[keyof typeof PRODUCT_STATUSES]`
## Async/Await Patterns
- Mark with `async` keyword
- Await Supabase calls and data fetching directly
- Return JSX or redirect/notFound
- Export async functions: `export async function GET(request: Request) { ... }`
- Always return `NextResponse.json()` or `NextResponse` with status code
- All external input (API routes, webhooks, server actions) validated with Zod
- Example: Define schema, call `.parse()` or `.safeParse()` on request body
- Not yet visible in scaffolded code but required per CLAUDE.md
## Environment Variables
- Prefix with `NEXT_PUBLIC_` only (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
- See `src/lib/supabase/server.ts` using `process.env.NEXT_PUBLIC_SUPABASE_URL`
- No prefix: `SUPABASE_SERVICE_ROLE`, `STRIPE_SECRET_KEY`, `WEBHOOK_SECRET`
- Never expose in client bundles or import from CSR
- Webhook secrets, API keys, service role keys never logged or exposed
- Use `.env.local` locally (not committed)
- Use Vercel env vars in production
## Next.js Patterns
- Located at `middleware.ts` in project root
- Handles i18n routing and session refresh
- See `/Users/axelignis/crisol/middleware.ts`
- All components are Server Components by default in Next.js 14 App Router
- Mark Client Components with `'use client'` at top of file
- Recursive; inherited by child routes
- Use for shared UI (header, sidebar, auth guards)
- Auth-guard layouts in `src/app/artesano/layout.tsx` and `src/app/admin/layout.tsx`
- Use `(name)` syntax to group routes without affecting URL structure
- Example: `src/app/[locale]/(seo)/` for SEO pages that don't add URL segment
## Rendering Strategy
- Blog, FAQ, Glosario pages: pre-generate at build time
- Use `generateStaticParams()` for dynamic routes
- Catalog, product detail, artisan profiles: regenerate on-demand when published
- Use `revalidate` on-demand via `/api/revalidate` webhook trigger
- Checkout, user panels (cuenta, artesano, admin): fetch fresh data per request
- Required for auth-dependent and personalized content
- Carrito (shopping cart): managed by Zustand in browser
- Filters and real-time interactions
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Three distinct user journey trees: public marketplace (`[locale]`), artisan dashboard (`artesano`), admin panel (`admin`)
- Server-first architecture leveraging RSC (React Server Components) with selective client interactivity
- Multi-tenancy via role-based layout guards in middleware and layout files
- Internationalization layer (`next-intl`) at application root
- Supabase session management integrated into every request via middleware
- Event-driven payment workflows (Stripe/Coinbase webhooks) with idempotency
## Layers
- Purpose: UI components for user interactions, optimized rendering
- Location: `src/components/` (organized by feature domain) and `src/app/[locale]/` (page routes)
- Contains: React components (TSX), page definitions, layout wrappers, UI primitives
- Depends on: Store layer (Zustand), lib utilities, i18n, Supabase client
- Used by: Next.js routing system, HTTP requests
- Purpose: External service integration, webhook handling, server-to-server communication
- Location: `src/app/api/` (route handlers)
- Contains: Payment webhooks (`webhooks/stripe`, `webhooks/coinbase`), integration routes (`couriers/quote`, `upload`, `currency`, `revalidate`, `og`)
- Depends on: Stripe SDK, Coinbase Commerce, Cloudinary, courier provider APIs
- Used by: External services (webhooks), client-side fetch calls, ISR triggers
- Purpose: Domain-specific operations, validation, payment processing, transformation
- Location: `src/lib/` (subdivided by domain)
- Contains:
- Depends on: Database, external SDKs
- Used by: API routes, server actions, server components
- Purpose: Client-side ephemeral state (cart, currency preference)
- Location: `src/store/` (Zustand stores), `src/hooks/` (custom hooks)
- Contains: `cart.store.ts`, `currency.store.ts`, `use-cart.ts`, `use-wishlist.ts`, `use-currency.ts`, `use-notifications.ts`
- Depends on: Nothing (pure client-side)
- Used by: Client components in checkout/cart flows
- Purpose: Supabase RPC/query interface, auth state
- Location: `src/lib/supabase/server.ts` (server context), `src/lib/supabase/client.ts` (browser context)
- Contains: Supabase client instantiation with cookie management
- Depends on: Supabase infrastructure
- Used by: All server components, API routes, middleware
- Purpose: Locale routing, message loading, request context
- Location: `src/i18n/` (routing config, request handler)
- Contains: `routing.ts` (defineRouting), `request.ts` (getRequestConfig)
- Depends on: `messages/` JSON files
- Used by: Middleware, layout root, components
## Data Flow
- Global cart: Zustand store in-memory + localStorage persistence
- Currency preference: Zustand store + cookie fallback
- Auth state: Supabase session cookies (managed by middleware)
- Per-request context: locale via `next-intl` provider chain
## Key Abstractions
- Purpose: Enforce user type permissions (admin, artisan, buyer)
- Examples: `src/app/artesano/layout.tsx`, `src/app/admin/layout.tsx`
- Pattern: Server component layout checks Supabase `profiles.role`, redirects if unauthorized
- Purpose: Provide context-aware auth state (server vs. browser)
- Examples: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`
- Pattern: Factory functions encapsulate cookie handling, session refresh per context
- Purpose: Abstract provider differences (Chilexpress, Starken, DHL, FedEx)
- Examples: `src/lib/couriers/index.ts` (main interface), `src/lib/couriers/chilexpress.ts`, etc.
- Pattern: Each courier module exports `quote(params)` function with provider-specific implementation
- Purpose: Reusable email templates with React Email component library
- Examples: `src/lib/resend/templates/order-confirmed.tsx`, `piece-approved.tsx`
- Pattern: TSX components rendering JSX structure, sent via Resend SDK in server actions
- Purpose: Centralized split payment logic preventing hardcoded rates
- Examples: `src/lib/utils/commission.ts`
- Pattern: Exports `calculateCommission(basePrice, rate)` and `calculateArtisanNet()` functions
- Purpose: Consistent Open Graph, JSON-LD schema generation
- Examples: `src/lib/seo/metadata.ts`, `src/lib/seo/schema.ts`
- Pattern: Exported helper functions like `generateProductSchema()`, `generateBreadcrumb()`
## Entry Points
- Location: `src/app/layout.tsx`
- Triggers: Every request at server start
- Responsibilities: Sets global meta, imports globals.css, renders children
- Location: `src/app/[locale]/layout.tsx`
- Triggers: Every request with locale segment
- Responsibilities: Wraps app with `NextIntlClientProvider`, loads messages, validates locale via `generateStaticParams()`
- Location: `src/app/[locale]/(seo)/` and siblings
- Triggers: HTTP requests to `/es/...` or `/en/...`
- Responsibilities: Render catalog, artisan profiles, blog, FAQ; generate SEO metadata
- Location: `src/app/[locale]/cuenta/`
- Triggers: Authenticated user navigates to account dashboard
- Responsibilities: Display orders, favorites, points; inherits auth guard from parent
- Location: `src/app/artesano/`
- Triggers: Artisan navigates or middleware redirects
- Responsibilities: Check role = 'artisan' or 'admin', render dashboard, piece management; server-side auth guard in layout
- Location: `src/app/admin/`
- Triggers: Admin navigates or middleware redirects
- Responsibilities: Check role = 'admin' only, render moderation queues, analytics; strictest auth guard
- Location: `src/app/api/`
- Triggers: HTTP POST/GET from frontend or external services
- Responsibilities: Webhook handling (Stripe, Coinbase), integration calls (couriers, upload, currency)
- Location: `middleware.ts` (root)
- Triggers: Every request before routing
- Responsibilities: Refresh Supabase session, validate locale, enforce auth cookies
## Error Handling
- API routes: Wrap Zod parsing in try-catch, return `NextResponse.json({ error }, { status: 400 })`
- Server components: Let errors bubble to error boundary or return fallback UI
- Client components: Use `onError` callback to dispatch toast notification via Zustand store
- Auth errors: Redirect to `/es/auth/login` via `redirect()` in layout guards
- Validation errors: Zod schema parsing in server actions, return typed error response
## Cross-Cutting Concerns
- Approach: `console` for development, structured logging libraries (e.g., Pino) optional in production
- Server-side operations log to stdout/stderr; available in Vercel logs
- Client-side errors captured via browser console
- Approach: Zod schemas at API route and server action entry points
- All external input (API bodies, query params, form submissions) validated before processing
- Database-level constraints (NOT NULL, UNIQUE, FOREIGN KEY) provide second layer
- Approach: Supabase Auth (email/password, OAuth)
- Session managed via httpOnly cookies (handled by middleware)
- Role checked on layout entry for protected routes
- Server-side operations use `service_role` key only in trusted contexts (never exposed to client)
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
