# External Integrations

**Analysis Date:** 2026-04-12

## APIs & External Services

**Payment Processing:**
- Stripe Connect - Split payment processing and artisan onboarding
  - SDK: `stripe` (17.1.0) server-side, `@stripe/stripe-js` + `@stripe/react-stripe-js` client-side
  - Auth: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (public), `STRIPE_SECRET_KEY` (server-side)
  - Webhook secret: `STRIPE_WEBHOOK_SECRET`
  - Implementation: `src/lib/stripe/client.ts`, `src/lib/stripe/split.ts`
  - Webhook endpoint: `/api/webhooks/stripe` (route.ts stub for signature verification)
  - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated` (onboarding), `transfer.created`

- Coinbase Commerce - Cryptocurrency payment option
  - SDK: HTTP client integration (no official SDK in dependencies)
  - Auth: `COINBASE_COMMERCE_API_KEY`, `COINBASE_COMMERCE_WEBHOOK_SECRET`
  - Implementation: `/api/webhooks/coinbase` (route.ts stub)

**Email Service:**
- Resend - Transactional email delivery
  - SDK: `resend` (4.0.0)
  - Auth: `RESEND_API_KEY`
  - Implementation: `src/lib/resend/client.ts` (stub), email templates in `src/lib/resend/templates/`
  - Templates available:
    - `artisan-new-piece.tsx` - Notify artisan when piece uploaded
    - `piece-approved.tsx` - Approval notification
    - `piece-rejected.tsx` - Rejection notification with feedback
    - `order-confirmed.tsx` - Buyer order confirmation
    - `order-shipped.tsx` - Shipment notification with tracking
    - `order-delivered.tsx` - Delivery confirmation
  - Configuration: `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `RESEND_ADMIN_EMAIL`

**Courier/Shipping APIs:**
- Chilexpress (Chile domestic)
  - Auth: `CHILEXPRESS_API_KEY`, `CHILEXPRESS_COD_CUENTA` (account number)
  - Implementation: `src/lib/couriers/chilexpress.ts`

- Starken (Chile domestic)
  - Auth: `STARKEN_USER`, `STARKEN_PASSWORD`
  - Implementation: `src/lib/couriers/starken.ts`

- DHL Express (International)
  - Auth: `DHL_API_KEY`, `DHL_API_SECRET`, `DHL_ACCOUNT_NUMBER`
  - Implementation: `src/lib/couriers/dhl.ts`

- FedEx (International)
  - Auth: `FEDEX_API_KEY`, `FEDEX_API_SECRET`, `FEDEX_ACCOUNT_NUMBER`
  - Implementation: `src/lib/couriers/fedex.ts`

- Courier Index: `src/lib/couriers/index.ts` (central router)
- Quote Endpoint: `/api/couriers/quote` (route.ts) - GET endpoint for shipping estimates

**Media/Asset Management:**
- Cloudinary - Image CDN, transformation, and upload signing
  - SDK: `cloudinary` (2.5.1)
  - Auth: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (public), `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (server-side)
  - Upload: `CLOUDINARY_UPLOAD_PRESET` (unsigned preset for direct client uploads)
  - Base folder: `CLOUDINARY_BASE_FOLDER` (organize assets)
  - Implementation: `src/lib/cloudinary/client.ts`, `src/lib/cloudinary/upload.ts`
  - Upload endpoint: `/api/upload` (route.ts) - Signs requests for Cloudinary widget
  - Next.js config: `next.config.mjs` has `remotePatterns` for `res.cloudinary.com`
  - Constraint: `MAX_PHOTOS_PER_PRODUCT = 10` (`src/lib/utils/constants.ts`)

**Analytics & SEO:**
- Google Analytics 4
  - Auth: `NEXT_PUBLIC_GA_MEASUREMENT_ID`
  - Implementation: Likely in head/script (not seen in config files)

- Google Search Console (optional, for admin panel integrations)
  - Auth: `GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY`, `GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL`, `GOOGLE_SEARCH_CONSOLE_SITE_URL`
  - Implementation: `src/lib/seo/schema.ts`, `src/lib/seo/sitemap.ts`, `src/lib/seo/metadata.ts`

**Currency Conversion:**
- Public Exchange Rate API (unnamed in code)
  - Endpoint: `/api/currency` (route.ts) - GET endpoint fetches live CLP/USD rate
  - Alternative: Optional `EXCHANGE_RATE_API_KEY` for external provider (not implemented yet)
  - Purpose: Display USD prices alongside CLP canonical prices (display-only, no persistence)

## Data Storage

**Databases:**
- Supabase (PostgreSQL 17)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client), `SUPABASE_SERVICE_ROLE_KEY` (server-side admin)
  - Project ID: `SUPABASE_PROJECT_ID` (for CLI operations)
  - Clients:
    - `@supabase/supabase-js` - JavaScript/TypeScript client
    - `@supabase/ssr` - Server-side rendering with Auth session handling
  - Implementation: `src/lib/supabase/client.ts` (browser client), `src/lib/supabase/server.ts` (server client)
  - Middleware: `src/lib/supabase/middleware.ts` (session refresh in edge middleware)
  - Generated types: `src/types/database.types.ts` (auto-generated from schema, regenerate with `pnpm db:types`)
  - RLS: Mandatory on all tables; service_role key only for server-side operations
  - Auth: Email signup enabled, 1-hour JWT expiry, refresh token rotation enabled
  - Storage: 50MiB max file size per object
  - Migrations: 8 numbered migrations in `supabase/migrations/`
    - 001_extensions.sql - PostgreSQL extensions
    - 002_users.sql - User, artisan, buyer tables with roles
    - 003_config.sql - Application configuration
    - 004_catalog.sql - Product/piece catalog
    - 005_commerce.sql - Orders, payments, shipping
    - 006_loyalty_content.sql - Loyalty and blog content
    - 007_indexes.sql - Database performance indexes
    - 008_triggers_rls.sql - Triggers and RLS policies

**File Storage:**
- Supabase Storage buckets (likely `pieces` or `products` for artisan work, profile images, etc.)
  - Managed via Supabase dashboard
  - RLS applies to bucket access

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (custom, built-in to Supabase)
  - Method: Email/password signup and login
  - Session: Cookies via `@supabase/ssr` (HttpOnly, secure in production)
  - Token refresh: Automatic via middleware (`src/lib/supabase/middleware.ts`)
  - Optional: OAuth providers (Google, Apple) mentioned in checklist but not seen configured
  - Roles: `admin`, `artisan`, `buyer` (managed in `user` table, enforced via RLS)
  - Layouts: `/artesano` and `/admin` are role-guarded (protected routes)

## Monitoring & Observability

**Error Tracking:**
- Not detected

**Logs:**
- Supabase logs (via Supabase dashboard)
- Application-level: Console (development) or Vercel logs (production)

**Performance:**
- Lighthouse CI - Configured in `lighthouserc.js` and `pnpm lhci` script
- Metrics monitored: Performance, Accessibility, Best Practices, SEO

## CI/CD & Deployment

**Hosting:**
- Vercel - Default Next.js deployment platform (environment variables configured in Vercel dashboard)

**CI Pipeline:**
- GitHub Actions (likely, .github/ directory exists but not examined in detail)
- Lighthouse CI runs as part of build process

## Environment Configuration

**Required env vars (Production):**

**Supabase:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon key for client (public, secured by RLS)
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side admin key (PRIVATE)
- `SUPABASE_PROJECT_ID` - For CLI operations

**Stripe:**
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Public key (client)
- `STRIPE_SECRET_KEY` - Secret key (server)
- `STRIPE_WEBHOOK_SECRET` - Webhook signature secret

**Coinbase:**
- `COINBASE_COMMERCE_API_KEY` - API key
- `COINBASE_COMMERCE_WEBHOOK_SECRET` - Webhook secret

**Cloudinary:**
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` - Cloud name (public)
- `CLOUDINARY_API_KEY` - API key (recommended private despite being "public")
- `CLOUDINARY_API_SECRET` - API secret (PRIVATE)
- `CLOUDINARY_UPLOAD_PRESET` - Unsigned preset for client uploads
- `CLOUDINARY_BASE_FOLDER` - Asset organization

**Resend:**
- `RESEND_API_KEY` - API key
- `RESEND_FROM_EMAIL` - Sender email (must be verified)
- `RESEND_FROM_NAME` - Sender name
- `RESEND_ADMIN_EMAIL` - Admin notification email

**Couriers:**
- `CHILEXPRESS_API_KEY`, `CHILEXPRESS_COD_CUENTA`
- `STARKEN_USER`, `STARKEN_PASSWORD`
- `DHL_API_KEY`, `DHL_API_SECRET`, `DHL_ACCOUNT_NUMBER`
- `FEDEX_API_KEY`, `FEDEX_API_SECRET`, `FEDEX_ACCOUNT_NUMBER`

**Google:**
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` - GA4 measurement ID (public)
- `GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY` - Service account key (JSON with newlines)
- `GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL` - Service account email
- `GOOGLE_SEARCH_CONSOLE_SITE_URL` - Site URL for GSC API

**Application:**
- `NEXT_PUBLIC_APP_URL` - Public app URL (no trailing slash)
- `CRON_SECRET` - Secret for cron jobs and manual operations (openssl rand -base64 32)
- `REVALIDATE_SECRET` - Secret for on-demand ISR revalidation from webhooks

**Optional:**
- `EXCHANGE_RATE_API_KEY` - For external currency provider (not yet implemented)

**Secrets location:**
- Local: `.env.local` (git-ignored, never committed)
- Production: Vercel environment variables (dashboard or CLI)
- Never expose: service_role key, secret keys, webhook secrets, courier API keys, cron/revalidate secrets

## Webhooks & Callbacks

**Incoming:**

- `/api/webhooks/stripe` - Listens for Stripe events
  - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`, `transfer.created`
  - Signature verification: `STRIPE_WEBHOOK_SECRET`
  - Idempotence: Must verify by `event.id` to prevent duplicate processing

- `/api/webhooks/coinbase` - Listens for Coinbase Commerce events
  - Signature verification: `COINBASE_COMMERCE_WEBHOOK_SECRET`
  - Idempotence: Must verify by `event.id`

**Outgoing:**
- Not detected in codebase (may be configured externally)

## Integration Points Summary

**Client → Server:**
- Stripe Elements for payment collection (`@stripe/react-stripe-js`)
- Cloudinary widget for direct image uploads (unsigned preset)
- Currency conversion via `/api/currency` endpoint
- Courier quote requests via `/api/couriers/quote` endpoint

**Server → External:**
- Stripe: Create payment intents, process transfers, manage Connect accounts (from `/api/` routes)
- Supabase: Database queries, Auth token refresh, file uploads (from Server Components, Actions, Routes)
- Resend: Send transactional emails (from Server Actions or webhook handlers)
- Cloudinary: Sign upload requests (from `/api/upload`), fetch media
- Couriers: Request shipping quotes and create labels (from API routes or Server Actions)
- Google: Analytics tracking (client-side pixel), GSC API (optional admin panel)

**Webhook Handlers:**
- Stripe → Database updates for order/payment status, artisan onboarding
- Coinbase → Database updates for crypto payment status
- Supabase Auth → User role assignment on signup (via trigger)

---

*Integration audit: 2026-04-12*
