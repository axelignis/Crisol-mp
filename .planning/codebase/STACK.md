# Technology Stack

**Analysis Date:** 2026-04-12

## Languages

**Primary:**
- TypeScript 5.6.2 - Application code, type-safe React components, API routes
- JavaScript (JSX/TSX) - React components, Next.js configuration

**Secondary:**
- SQL - Supabase database migrations and schema
- TOML - Supabase configuration (`supabase/config.toml`)

## Runtime

**Environment:**
- Node.js (via pnpm package manager)
- Next.js 14.2.15 (App Router)

**Package Manager:**
- pnpm - Monorepo support, fast lockfile
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- Next.js 14.2.15 - React framework with App Router, server actions, middleware, built-in optimizations
- React 18.3.1 - UI library
- React DOM 18.3.1 - React web binding

**Internationalization:**
- next-intl 3.20.0 - Multi-language support (Spanish `es` default, English `en`)
- Plugin: `src/i18n/request.ts`

**Styling:**
- Tailwind CSS 3.4.13 - Utility-first CSS framework
- PostCSS 8.4.47 - CSS processing
- Autoprefixer 10.4.20 - Vendor prefixes

**State Management:**
- Zustand 4.5.5 - Lightweight state management (`src/store/`)

**Testing:**
- Vitest 2.1.2 - Unit/integration test runner
- Playwright 1.48.0 - E2E testing framework
- Config: `playwright.config.ts`, test files in `tests/e2e/`

**Build/Dev:**
- Next.js built-in bundler and dev server
- TypeScript compiler (strict mode enabled)
- ESLint 8.57.1 - Linting (via eslintrc.json)
- next-sitemap 4.2.3 - Sitemap generation

**Performance/SEO:**
- Lighthouse CI (@lhci/cli 0.14.0) - Performance monitoring
- Config: `lighthouserc.js`

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.45.4 - Supabase client SDK for database, auth, storage
- @supabase/ssr 0.5.1 - Server-side rendering support with Supabase Auth
- stripe 17.1.0 - Stripe server-side SDK for payment processing and Connect
- @stripe/stripe-js 4.6.0 - Stripe.js client library for payment collection
- @stripe/react-stripe-js 2.8.0 - React components for Stripe integration

**Infrastructure:**
- cloudinary 2.5.1 - CDN and image transformation service SDK
- resend 4.0.0 - Transactional email service SDK
- @react-email/components 0.0.25 - React component email templates
- zod 3.23.8 - TypeScript-first schema validation (API input validation)

**Build Requirements:**
- @types/node 20.16.11 - Node.js type definitions
- @types/react 18.3.11 - React type definitions
- @types/react-dom 18.3.0 - React DOM type definitions

## Configuration

**Environment:**
- Configured via `.env.local` (local development) and Vercel environment variables (production)
- Environment file example: `crisol.env.example` (with inline documentation)
- Variables organized by service: Supabase, Stripe, Coinbase, Cloudinary, Resend, couriers, Google APIs
- NEXT_PUBLIC_* pattern used for client-side variables (URL, keys safe with RLS/CORS)
- Server-side secrets: service keys, API secrets, webhook secrets (never exposed to client)

**Build:**
- `next.config.mjs` - Next.js configuration (Cloudinary image remotePatterns, next-intl plugin, optional Google Model Viewer)
- `tsconfig.json` - TypeScript compiler options (strict mode, ES2022 target, path aliases `@/*` → `src/*`)
- `tailwind.config.ts` - Tailwind configuration (app and components directories)
- `postcss.config.js` - PostCSS pipeline (Tailwind, autoprefixer)
- `middleware.ts` - Next.js middleware (locale routing with next-intl, potentially Supabase session refresh)

**Database:**
- `supabase/config.toml` - Supabase local development configuration
  - PostgreSQL 17 (major_version = 17)
  - API port 54321, DB port 54322, Studio port 54323
  - Auth enabled with email signup, JWT expiry 1 hour, refresh token rotation enabled
  - Storage enabled (50MiB max file size), Realtime enabled, Edge runtime enabled (Deno v2)
  - Migrations tracked in `supabase/migrations/` (numbered 001-008)

## Platform Requirements

**Development:**
- Node.js (for pnpm)
- Supabase CLI (for `supabase start`, database migrations, type generation)
- PostgreSQL 17 (via Supabase local)
- Playwright browsers (for E2E tests)

**Production:**
- Vercel (default Next.js hosting platform)
- Supabase project (cloud-hosted PostgreSQL, Auth, Storage, Realtime)
- Stripe account with Connect enabled
- Cloudinary account for CDN
- Resend account for transactional emails

## Key Scripts

```bash
pnpm dev              # Start Next.js dev server + Supabase local
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm test             # Run Vitest (unit/integration)
pnpm test:watch       # Vitest watch mode
pnpm test:e2e         # Run Playwright E2E tests
pnpm db:types         # Regenerate src/types/database.types.ts from Supabase schema
pnpm lhci             # Run Lighthouse CI
```

---

*Stack analysis: 2026-04-12*
