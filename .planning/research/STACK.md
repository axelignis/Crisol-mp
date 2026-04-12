# Stack Research

**Domain:** Multi-vendor artisanal jewelry e-commerce marketplace
**Researched:** 2026-04-12
**Confidence:** HIGH (core stack locked via ADR; complementary libs verified against npm/official docs)

## Existing Stack (Locked -- ADR-001 to ADR-006)

These are already installed and configured. Do NOT re-evaluate.

| Technology | Version (installed) | Purpose |
|------------|---------------------|---------|
| Next.js | 14.2.15 | App Router, RSC, ISR, server actions |
| React | 18.3.1 | UI library |
| TypeScript | 5.6.2 | Type safety |
| Tailwind CSS | 3.4.13 | Styling |
| @supabase/supabase-js | 2.45.4 | Database, Auth, Storage, Realtime |
| @supabase/ssr | 0.5.1 | Server-side auth with cookies |
| stripe | 17.1.0 | Server-side Stripe Connect, checkout |
| @stripe/stripe-js | 4.6.0 | Client-side Stripe Elements |
| @stripe/react-stripe-js | 2.8.0 | React bindings for Stripe |
| cloudinary | 2.5.1 | Server-side signed uploads |
| resend | 4.0.0 | Transactional email |
| @react-email/components | 0.0.25 | Email templates in React |
| next-intl | 3.20.0 | i18n (es default, en) |
| zustand | 4.5.5 | Client state (cart, currency) |
| zod | 3.23.8 | Input validation |
| next-sitemap | 4.2.3 | Sitemap generation |
| Vitest | 2.1.2 | Unit/integration testing |
| Playwright | 1.48.0 | E2E testing |
| ESLint | 8.57.1 | Linting |

**Version note on next-intl:** v4.x is available (latest 4.9.1) with smaller bundle and TypeScript augmentation improvements. However, the project uses Next.js 14 (not 15), and v3.20.0 is the stable choice for this combination. Upgrade to v4 only if/when the project moves to Next.js 15. LOW risk staying on v3.

**Version note on @supabase/supabase-js:** Latest is 2.103.0. The installed 2.45.4 is old. Recommend updating to `^2.103.0` for bug fixes and type improvements. The v2 API surface is stable -- no breaking changes.

## Recommended Stack -- New Libraries to Add

### Forms and Validation

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| react-hook-form | ^7.72.1 | Form state management | Performant (uncontrolled inputs), native Zod integration via resolvers, standard for Next.js forms. Avoids re-renders on every keystroke -- critical for product creation forms with 15+ fields. | HIGH |
| @hookform/resolvers | ^5.2.2 | Zod resolver for react-hook-form | Bridges react-hook-form to existing Zod schemas. Reuse the same Zod schemas from API validation in client forms. | HIGH |

### UI Components

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| shadcn/ui (v4 CLI) | latest CLI | Component primitives (dialog, dropdown, table, tabs, sheet, command) | Not an npm dependency -- copies components into `src/components/ui/`. Built on Radix UI + Tailwind. Admin panel needs tables, dialogs, dropdowns, sheets. Marketplace needs product cards, filters, modals. shadcn gives accessible primitives without a heavy runtime. | HIGH |
| lucide-react | ^1.8.0 | Icon set | Default icon set for shadcn/ui. Tree-shakeable SVGs, 1500+ icons. Consistent with shadcn ecosystem. | HIGH |
| sonner | ^2.0.7 | Toast notifications | Simplest toast API (`toast("Done")` from anywhere). Integrates with shadcn/ui. Needed for: add-to-cart, order status changes, form submission feedback, webhook errors in admin. | HIGH |
| clsx | ^2.1.1 | Conditional classnames | Tiny utility for conditional Tailwind classes. Required by the `cn()` pattern used with shadcn/ui. | HIGH |
| tailwind-merge | ^2.6.0 | Tailwind class conflict resolution | Prevents `p-4 p-2` conflicts in component overrides. Required by the `cn()` pattern. | HIGH |

### URL State and Catalog Filters

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| nuqs | ^2.4.0 | Type-safe URL search params | Catalog filters (material, price range, technique, occasion) must be URL-shareable and SSR-compatible. nuqs is the standard for Next.js App Router URL state. Used by Vercel, Supabase, Sentry. Supports Next.js >=14.2.0. | HIGH |

### Cloudinary Integration

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| next-cloudinary | ^6.x | CldImage, CldUploadWidget components | Wraps Cloudinary for Next.js Image optimization. CldImage gives automatic WebP/AVIF with responsive sizing. CldUploadWidget provides signed upload widget. Project already has raw `cloudinary` SDK for server-side; next-cloudinary adds the React/Next.js layer. | MEDIUM |

### 3D Model Viewer

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| @google/model-viewer | ^4.2.0 | 3D product visualization (GLB/glTF) | Web component -- works in any React app via dynamic import. PROJECT.md requires 1 model 3D per piece. model-viewer is Google-maintained, supports AR on mobile, lazy-loads Three.js. Load via `next/dynamic` with `ssr: false`. | HIGH |

### Charts (Admin Dashboard)

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| recharts | ^2.15.0 | Admin dashboard charts (sales, commissions) | Lightweight, React-native (not D3 wrapper). Admin needs: sales over time, commission breakdown, order status distribution. Recharts handles these without the complexity of D3. shadcn/ui has a charts component built on Recharts. | MEDIUM |

### Date Handling

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| date-fns | ^4.1.0 | Date formatting and manipulation | Tree-shakeable (import only what you use). Needed for: order timestamps, coupon expiry, dashboard date ranges, "created 3 days ago" displays. Functional API aligns with project's functional utility pattern (`src/lib/utils/`). | HIGH |

### State Machine (Order + Piece Lifecycle)

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| (none -- use plain TypeScript) | -- | Order and piece state transitions | XState v5 (5.30.0) is powerful but overkill for 2 linear state machines with 6-7 states each. The project's state machines are simple enough for a typed transition map: `Record<State, State[]>` with a `canTransition(from, to)` function. Avoids 40KB+ dependency for what amounts to a lookup table. | HIGH |

### Courier Integrations

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| (no npm packages) | -- | Chilexpress, Starken, DHL, FedEx | No reliable npm wrappers exist. Build thin API clients in `src/lib/couriers/` using native `fetch`. Chilexpress has REST API at developers.wschilexpress.com. DHL and FedEx have official REST APIs. Each courier client: rate quote, create shipment, get tracking. Wrap behind a `CourierProvider` interface for polymorphism. | HIGH |

### Email Templates

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| (already installed: @react-email/components) | 0.0.25 | Email template components | Already in package.json. Use with Resend. Build templates in `src/emails/` for: order confirmation, shipping notification, piece approval/rejection, artisan onboarding. | HIGH |

## Development Tools to Add

| Tool | Purpose | Notes |
|------|---------|-------|
| prettier | Code formatting | Not yet in devDependencies. Add with tailwind plugin for class sorting. |
| prettier-plugin-tailwindcss | Auto-sort Tailwind classes | Prevents inconsistent class ordering across team. |
| @testing-library/react | Component unit tests | Vitest alone doesn't provide React rendering utilities. Needed for testing form validation, cart behavior, filter interactions. |
| msw (Mock Service Worker) | ^2.x | API mocking for tests. Mock Stripe webhooks, Supabase responses, courier APIs without hitting real services. |

## Installation

```bash
# Core new dependencies
pnpm add react-hook-form @hookform/resolvers nuqs lucide-react sonner clsx tailwind-merge next-cloudinary @google/model-viewer recharts date-fns

# Dev dependencies
pnpm add -D prettier prettier-plugin-tailwindcss @testing-library/react @testing-library/jest-dom msw

# shadcn/ui (not an npm install -- uses CLI)
pnpm dlx shadcn@latest init
# Then add components as needed:
pnpm dlx shadcn@latest add button dialog dropdown-menu table tabs sheet input select badge command separator
```

## Update existing dependencies

```bash
# Bump Supabase client to latest v2
pnpm add @supabase/supabase-js@^2.103.0 @supabase/ssr@latest
```

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| react-hook-form + zod | Formik | Formik is heavier, re-renders on every change, slower for large forms. RHF + Zod resolver reuses existing Zod schemas. |
| shadcn/ui (copy-paste) | Radix UI (direct) | shadcn gives pre-styled Tailwind components. Using Radix directly means writing all styles from scratch. |
| shadcn/ui (copy-paste) | Material UI | MUI brings its own styling system (Emotion), conflicts with Tailwind. Heavy bundle for a marketplace that needs speed. |
| nuqs | Manual useSearchParams | Manual approach lacks type safety, serialization, debouncing, SSR hydration handling. nuqs is 6KB and solves all of these. |
| recharts | Chart.js / Tremor | Chart.js requires canvas (not SSR-friendly). Tremor is built ON recharts but adds abstraction we don't need. Direct recharts gives more control for admin dashboards. |
| date-fns | Day.js | Day.js is smaller (2KB) but not tree-shakeable. date-fns v4 tree-shakes to similar size when importing specific functions. Functional API fits project style. |
| date-fns | Temporal API | Temporal is still Stage 3 (not available in Node.js without polyfill). Use date-fns now, migrate to Temporal when it ships natively. |
| Plain TS state machine | XState v5 | XState adds 40KB+ for two simple linear state machines. Overkill. A typed `canTransition()` function is 50 lines of code. |
| Custom courier clients | ShipEngine/Shippo | Third-party aggregators add cost per label and don't support Chilexpress/Starken (Chile-specific carriers). Direct API integration is necessary. |
| next-cloudinary | Custom Cloudinary components | next-cloudinary wraps Next.js Image with Cloudinary CDN URLs. Writing this manually is error-prone and duplicates work the library already handles. |
| sonner | react-hot-toast | Sonner has better animations, promise-based toasts, and native shadcn integration. react-hot-toast is unmaintained since 2023. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Prisma ORM | Supabase client handles all queries with RLS. Adding Prisma duplicates the data layer and bypasses RLS security. | @supabase/supabase-js with generated types via `pnpm db:types` |
| NextAuth / Auth.js | Supabase Auth is already configured with email/password, JWT, session refresh. Adding NextAuth creates auth conflicts. | @supabase/ssr for server-side session handling |
| Redux / Redux Toolkit | Overkill for this app's client state (cart + currency toggle). Zustand is already installed and handles it in 50 lines. | zustand (already installed) |
| Moment.js | Deprecated by its own maintainers. 300KB+ bundle. | date-fns |
| styled-components / Emotion | Conflicts with Tailwind. Adds runtime CSS-in-JS overhead. Incompatible with RSC. | Tailwind CSS (already installed) |
| tRPC | Adds unnecessary complexity when using Supabase client directly. The app's API surface is mostly server actions + Supabase RPC, not a REST/tRPC API. | Next.js server actions + Supabase RPC |
| Drizzle ORM | Same problem as Prisma -- bypasses Supabase RLS. The project's security model depends on RLS applied at the Supabase client level. | @supabase/supabase-js |
| SWR | Less feature-rich than TanStack Query. However, neither is strictly needed -- RSC + server actions handle most data fetching. Only add TanStack Query if client-side polling/optimistic updates become complex. | Server components for reads, server actions for mutations |
| Zod v4 | Still has compatibility issues with @hookform/resolvers (GitHub issue #4992). Stay on v3.x until ecosystem catches up. | zod ^3.23.8 (already installed) |

## Stack Patterns by Variant

**For catalog pages (public, SEO-critical):**
- Use RSC (React Server Components) for data fetching
- Use ISR with `revalidate` for caching
- Use nuqs for filter state in URL
- Use next-cloudinary CldImage for product images
- Do NOT use client-side data fetching (no useEffect, no TanStack Query)

**For artisan/admin panels (authenticated, interactive):**
- Use server actions for mutations (create piece, approve piece, update order status)
- Use react-hook-form + zod for complex forms (piece creation: 15+ fields, variants, media)
- Use sonner for mutation feedback
- Use recharts for admin dashboard charts
- Use shadcn/ui Table + Command for data management

**For checkout flow (mixed SSR + client):**
- Server action to create Stripe Checkout Session
- @stripe/react-stripe-js Elements for card input (client component)
- Server action to verify payment via webhook
- Plain TypeScript state machine for order status transitions

**For courier integration:**
- Abstract behind `CourierProvider` interface in `src/lib/couriers/`
- Each courier: `quote(origin, destination, package)`, `createShipment(...)`, `getTracking(id)`
- Call from server actions only (API keys stay server-side)
- Zod schemas for courier API responses (external data = untrusted)

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| react-hook-form ^7.72.1 | zod ^3.23.8 via @hookform/resolvers ^5.2.2 | Do NOT upgrade to Zod v4 yet -- resolver compatibility issues. |
| next-cloudinary ^6.x | Next.js 14.2.x | Verify exact version supports Next 14 (not just 15). |
| nuqs ^2.4.0 | Next.js >=14.2.0 | Confirmed compatible. |
| shadcn/ui v4 CLI | Tailwind CSS 3.x, React 18.x | Works with current stack. When project upgrades to Tailwind 4 + React 19, re-run shadcn init. |
| @google/model-viewer ^4.2.0 | three.js (peer dep, auto-installed) | Must use `next/dynamic` with `ssr: false` -- it's a web component. |
| sonner ^2.0.7 | React 18+ | No issues. |
| recharts ^2.15.0 | React 18+ | No issues. |

## Sources

- [npm: @supabase/supabase-js](https://www.npmjs.com/package/@supabase/supabase-js) -- latest v2.103.0 confirmed
- [npm: react-hook-form](https://www.npmjs.com/package/react-hook-form) -- v7.72.1 confirmed
- [npm: @hookform/resolvers](https://www.npmjs.com/package/@hookform/resolvers) -- v5.2.2, Zod v4 compatibility issue noted
- [npm: @tanstack/react-query](https://www.npmjs.com/package/@tanstack/react-query) -- v5.97.0 (decided NOT to include -- RSC handles reads)
- [shadcn/ui changelog March 2026](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) -- CLI v4 release confirmed
- [npm: lucide-react](https://www.npmjs.com/package/lucide-react) -- v1.8.0 confirmed
- [npm: sonner](https://www.npmjs.com/package/sonner) -- v2.0.7 confirmed
- [npm: nuqs](https://nuqs.dev/) -- confirmed Next.js >=14.2.0 support
- [npm: @google/model-viewer](https://www.npmjs.com/package/@google/model-viewer) -- v4.2.0 confirmed
- [npm: xstate](https://www.npmjs.com/package/xstate) -- v5.30.0 (evaluated, decided against)
- [Chilexpress Developer Portal](https://developers.wschilexpress.com/) -- REST API for quotes, shipments, tracking
- [Stripe Connect Marketplace Guide](https://docs.stripe.com/connect/end-to-end-marketplace) -- onboarding best practices
- [next-intl v4 blog](https://next-intl.dev/blog/next-intl-4-0) -- v4 available but v3 fine for Next.js 14
- [date-fns vs Day.js 2026](https://www.pkgpulse.com/blog/best-javascript-date-libraries-2026) -- tree-shaking comparison
- [Zod v4 + hookform issue](https://github.com/colinhacks/zod/issues/4992) -- compatibility problem confirmed

---
*Stack research for: Crisol artisanal jewelry marketplace*
*Researched: 2026-04-12*
