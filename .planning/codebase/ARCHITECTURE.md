# Architecture

**Analysis Date:** 2026-04-12

## Pattern Overview

**Overall:** Next.js 14 App Router with role-based compartmentalization and multi-locale support.

**Key Characteristics:**
- Three distinct user journey trees: public marketplace (`[locale]`), artisan dashboard (`artesano`), admin panel (`admin`)
- Server-first architecture leveraging RSC (React Server Components) with selective client interactivity
- Multi-tenancy via role-based layout guards in middleware and layout files
- Internationalization layer (`next-intl`) at application root
- Supabase session management integrated into every request via middleware
- Event-driven payment workflows (Stripe/Coinbase webhooks) with idempotency

## Layers

**Presentation Layer:**
- Purpose: UI components for user interactions, optimized rendering
- Location: `src/components/` (organized by feature domain) and `src/app/[locale]/` (page routes)
- Contains: React components (TSX), page definitions, layout wrappers, UI primitives
- Depends on: Store layer (Zustand), lib utilities, i18n, Supabase client
- Used by: Next.js routing system, HTTP requests

**API Layer:**
- Purpose: External service integration, webhook handling, server-to-server communication
- Location: `src/app/api/` (route handlers)
- Contains: Payment webhooks (`webhooks/stripe`, `webhooks/coinbase`), integration routes (`couriers/quote`, `upload`, `currency`, `revalidate`, `og`)
- Depends on: Stripe SDK, Coinbase Commerce, Cloudinary, courier provider APIs
- Used by: External services (webhooks), client-side fetch calls, ISR triggers

**Business Logic Layer:**
- Purpose: Domain-specific operations, validation, payment processing, transformation
- Location: `src/lib/` (subdivided by domain)
- Contains:
  - `lib/supabase/`: Database client factories (server/client contexts)
  - `lib/stripe/`: Payment split logic, Stripe account operations
  - `lib/cloudinary/`: Image transformations, upload signature generation
  - `lib/couriers/`: Unified shipping quote interface
  - `lib/resend/`: Email template composition
  - `lib/seo/`: Metadata generation, schema builders
  - `lib/utils/`: Currency conversion, slug generation, commission calculations
- Depends on: Database, external SDKs
- Used by: API routes, server actions, server components

**State Management Layer:**
- Purpose: Client-side ephemeral state (cart, currency preference)
- Location: `src/store/` (Zustand stores), `src/hooks/` (custom hooks)
- Contains: `cart.store.ts`, `currency.store.ts`, `use-cart.ts`, `use-wishlist.ts`, `use-currency.ts`, `use-notifications.ts`
- Depends on: Nothing (pure client-side)
- Used by: Client components in checkout/cart flows

**Data Access Layer:**
- Purpose: Supabase RPC/query interface, auth state
- Location: `src/lib/supabase/server.ts` (server context), `src/lib/supabase/client.ts` (browser context)
- Contains: Supabase client instantiation with cookie management
- Depends on: Supabase infrastructure
- Used by: All server components, API routes, middleware

**Internationalization Layer:**
- Purpose: Locale routing, message loading, request context
- Location: `src/i18n/` (routing config, request handler)
- Contains: `routing.ts` (defineRouting), `request.ts` (getRequestConfig)
- Depends on: `messages/` JSON files
- Used by: Middleware, layout root, components

## Data Flow

**Request Entry Point:**
1. Middleware (`middleware.ts`) intercepts every request
2. Supabase session refreshed via `updateSession()` → cookies updated
3. Locale extracted and validated via `next-intl` middleware
4. Request proceeds to layout/page with locale context

**Authenticated Route Flow (e.g., `/artesano/piezas`):**
1. Request → Middleware (session refresh)
2. `src/app/artesano/layout.tsx` (server component)
3. Layout calls `createClient()` from `src/lib/supabase/server.ts`
4. Supabase auth check: `getUser()`
5. Role validation: query `profiles` table for role
6. Mismatch → `redirect()` to login or home
7. Valid → render children (page component)

**Public Page Flow (e.g., `/es/catalogo/[slug]`):**
1. Request → Middleware (session refresh, locale parsing)
2. `src/app/[locale]/layout.tsx` wraps with locale messages
3. `src/app/[locale]/catalogo/[slug]/page.tsx` renders
4. Page uses ISR with `revalidate: 3600` + on-demand revalidation
5. Metadata generation via `generateMetadata()` helper
6. JSON-LD injected for SEO

**Cart State Mutation (Client-Side):**
1. User clicks "Add to Cart" in component
2. Component calls Zustand hook `useCart().addItem(product)`
3. Store updates in-memory state → local persistence to localStorage
4. Component re-renders with new cart count
5. No server roundtrip until checkout

**Payment Processing:**
1. User submits checkout form → validates Zod schema
2. API route or server action initiates payment intent
3. Stripe/Coinbase returns session URL or widget
4. User completes payment in provider's UI
5. Provider sends webhook to `/api/webhooks/stripe` or `/api/webhooks/coinbase`
6. API route verifies signature, checks idempotency via `event.id`
7. Server action updates `orders` table state
8. Optional: email sent via Resend template
9. Frontend polls for confirmation or uses callback redirect

**Revalidation On-Demand:**
1. Piece published/approved by admin
2. Server action or webhook handler calls `revalidate('/es/catalogo')` or specific route
3. Background job invalidates ISR cache
4. Next request fetches fresh page

**State Management:**
- Global cart: Zustand store in-memory + localStorage persistence
- Currency preference: Zustand store + cookie fallback
- Auth state: Supabase session cookies (managed by middleware)
- Per-request context: locale via `next-intl` provider chain

## Key Abstractions

**Role-Based Access Control (RBAC):**
- Purpose: Enforce user type permissions (admin, artisan, buyer)
- Examples: `src/app/artesano/layout.tsx`, `src/app/admin/layout.tsx`
- Pattern: Server component layout checks Supabase `profiles.role`, redirects if unauthorized

**Supabase Client Instantiation:**
- Purpose: Provide context-aware auth state (server vs. browser)
- Examples: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`
- Pattern: Factory functions encapsulate cookie handling, session refresh per context

**Unified Courier Interface:**
- Purpose: Abstract provider differences (Chilexpress, Starken, DHL, FedEx)
- Examples: `src/lib/couriers/index.ts` (main interface), `src/lib/couriers/chilexpress.ts`, etc.
- Pattern: Each courier module exports `quote(params)` function with provider-specific implementation

**Email Template Composition:**
- Purpose: Reusable email templates with React Email component library
- Examples: `src/lib/resend/templates/order-confirmed.tsx`, `piece-approved.tsx`
- Pattern: TSX components rendering JSX structure, sent via Resend SDK in server actions

**Commission Calculation:**
- Purpose: Centralized split payment logic preventing hardcoded rates
- Examples: `src/lib/utils/commission.ts`
- Pattern: Exports `calculateCommission(basePrice, rate)` and `calculateArtisanNet()` functions

**SEO Metadata Builders:**
- Purpose: Consistent Open Graph, JSON-LD schema generation
- Examples: `src/lib/seo/metadata.ts`, `src/lib/seo/schema.ts`
- Pattern: Exported helper functions like `generateProductSchema()`, `generateBreadcrumb()`

## Entry Points

**Root Layout:**
- Location: `src/app/layout.tsx`
- Triggers: Every request at server start
- Responsibilities: Sets global meta, imports globals.css, renders children

**Locale Root Layout:**
- Location: `src/app/[locale]/layout.tsx`
- Triggers: Every request with locale segment
- Responsibilities: Wraps app with `NextIntlClientProvider`, loads messages, validates locale via `generateStaticParams()`

**Public Routes:**
- Location: `src/app/[locale]/(seo)/` and siblings
- Triggers: HTTP requests to `/es/...` or `/en/...`
- Responsibilities: Render catalog, artisan profiles, blog, FAQ; generate SEO metadata

**Authenticated Routes - Buyer:**
- Location: `src/app/[locale]/cuenta/`
- Triggers: Authenticated user navigates to account dashboard
- Responsibilities: Display orders, favorites, points; inherits auth guard from parent

**Authenticated Routes - Artisan:**
- Location: `src/app/artesano/`
- Triggers: Artisan navigates or middleware redirects
- Responsibilities: Check role = 'artisan' or 'admin', render dashboard, piece management; server-side auth guard in layout

**Authenticated Routes - Admin:**
- Location: `src/app/admin/`
- Triggers: Admin navigates or middleware redirects
- Responsibilities: Check role = 'admin' only, render moderation queues, analytics; strictest auth guard

**API Routes:**
- Location: `src/app/api/`
- Triggers: HTTP POST/GET from frontend or external services
- Responsibilities: Webhook handling (Stripe, Coinbase), integration calls (couriers, upload, currency)

**Middleware:**
- Location: `middleware.ts` (root)
- Triggers: Every request before routing
- Responsibilities: Refresh Supabase session, validate locale, enforce auth cookies

## Error Handling

**Strategy:** Server-side try-catch with typed Zod validation; client-side toast/modal feedback.

**Patterns:**
- API routes: Wrap Zod parsing in try-catch, return `NextResponse.json({ error }, { status: 400 })`
- Server components: Let errors bubble to error boundary or return fallback UI
- Client components: Use `onError` callback to dispatch toast notification via Zustand store
- Auth errors: Redirect to `/es/auth/login` via `redirect()` in layout guards
- Validation errors: Zod schema parsing in server actions, return typed error response

## Cross-Cutting Concerns

**Logging:** 
- Approach: `console` for development, structured logging libraries (e.g., Pino) optional in production
- Server-side operations log to stdout/stderr; available in Vercel logs
- Client-side errors captured via browser console

**Validation:** 
- Approach: Zod schemas at API route and server action entry points
- All external input (API bodies, query params, form submissions) validated before processing
- Database-level constraints (NOT NULL, UNIQUE, FOREIGN KEY) provide second layer

**Authentication:** 
- Approach: Supabase Auth (email/password, OAuth)
- Session managed via httpOnly cookies (handled by middleware)
- Role checked on layout entry for protected routes
- Server-side operations use `service_role` key only in trusted contexts (never exposed to client)

---

*Architecture analysis: 2026-04-12*
