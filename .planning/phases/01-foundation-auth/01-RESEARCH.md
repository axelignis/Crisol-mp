# Phase 1: Foundation & Auth - Research

**Researched:** 2026-04-12
**Domain:** Supabase PostgreSQL schema, RLS, Auth, Next.js App Router auth guards, CLP integer arithmetic
**Confidence:** HIGH

## Summary

Phase 1 rewrites 8 existing migrations from scratch (D-01), establishes the full 22-entity schema with Stripe Connect model (D-02), implements Supabase Auth with role-based JWT claims for RLS, and builds core utilities (CLP arithmetic, commission calculation, state machines, webhook idempotency).

The existing codebase has solid scaffolding: Supabase client/server/middleware files are correctly implemented, layout auth guards exist (need table name fix from `profiles` to `user`), and constants for statuses/roles are already defined. The main work is rewriting migrations with Stripe Connect fields, implementing the custom access token hook for JWT role claims, building the commission/CLP utilities, and creating PostgreSQL state machine functions with row locks.

**Primary recommendation:** Use Supabase Custom Access Token Auth Hook to inject `user_role` into JWT claims directly. This eliminates per-query lookups in RLS helper functions and is the officially recommended pattern for RBAC. Store all monetary values as INTEGER (CLP centavos equivalent -- but CLP is zero-decimal so just integer CLP). Use `BIGINT` for amounts to avoid overflow on aggregates.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Rewrite all 8 existing migrations from scratch -- current migrations have inconsistencies (layout references `profiles` table that doesn't exist, artisan table has manual bank transfer fields incompatible with Stripe Connect model)
- **D-02:** Artisan payout model is Stripe Connect (Express accounts) -- remove all manual bank transfer fields (bank_name, bank_account_type, bank_account_number, bank_rut, bank_email) from artisan table. Add stripe_account_id instead.
- **D-03:** Admin-only artisan creation -- no public artisan registration. Fits the family marketplace model (4-6 initial artisans).
- **D-04:** Admin creates artisan account directly from admin panel (enters email + name), system sends invitation email with password setup link. Artisans never go through buyer registration.
- **D-05:** Branded split-screen layout for login/register pages -- left side: hero image of artisan jewelry + brand messaging; right side: auth form. Sets marketplace tone from first interaction.
- **D-06:** After registration, redirect to homepage (catalog) with persistent banner: "Verifica tu email para comprar". Buyers can browse but cannot checkout until email is verified.
- **D-07:** Commission stored in DB table with history -- commission_config table with effective_from date. Each change inserts a new row. Orders snapshot the active rate at payment time. Admin edits via panel.
- **D-08:** Initial commission percentage is 10%.

### Claude's Discretion
- Exact split-screen image selection and brand copy
- RLS policy naming conventions
- State machine function signatures and error messages
- CLP utility API design (function names, parameter order)
- Migration file numbering and grouping strategy

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Database schema completo (22 entidades) con migraciones forward-only en Supabase | Existing migrations analyzed; rewrite plan with Stripe Connect model documented |
| FOUND-02 | RLS activo en toda tabla con politicas por rol (admin, artisan, buyer) | Existing RLS policies analyzed; custom access token hook pattern for JWT claims |
| FOUND-03 | Funciones de transicion de estado en PostgreSQL con row locks (product y order state machines) | PL/pgSQL pattern with SELECT FOR UPDATE documented |
| FOUND-04 | Utilidad CLP como moneda zero-decimal (aritmetica de enteros, sin floating point) | INTEGER storage, TypeScript utility patterns documented |
| FOUND-05 | Commission.ts con calculo entero donde comision + neto artesano = total exacto | Floor/ceil split pattern documented; testing strategy from docs/testing_strategy.md |
| FOUND-06 | Tabla de idempotencia para webhooks (event.id -> processed) | webhook_event table pattern documented |
| AUTH-01 | User puede registrarse con email y contrasena via Supabase Auth | Supabase Auth email/password with auto-create trigger pattern |
| AUTH-02 | User recibe verificacion de email tras registro | Supabase Auth built-in email verification; redirect-to-homepage-with-banner pattern (D-06) |
| AUTH-03 | User puede recuperar contrasena via email | Supabase Auth built-in password recovery |
| AUTH-04 | Sesion persiste entre refreshes del navegador (middleware Supabase) | Existing middleware.ts + supabase/middleware.ts already handle this |
| AUTH-05 | Guards por rol en layouts: /artesano requiere rol artisan, /admin requiere rol admin | Existing layout guards need table name fix from `profiles` to `user` |
| AUTH-06 | JWT claims incluyen rol del usuario para RLS | Custom Access Token Auth Hook pattern documented |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack:** Next.js App Router, TypeScript, Tailwind, next-intl, Zustand, Zod, Supabase (Postgres + Auth + Storage + RLS), Stripe Connect, pnpm
- **Naming:** kebab-case files, PascalCase types, camelCase functions, UPPER_SNAKE_CASE constants, snake_case DB
- **Security:** RLS on every table; service_role only server-side; never expose secrets client-side
- **Migrations:** forward-only, numbered in `supabase/migrations/`; `database.types.ts` autogenerated, never edit
- **Validation:** All external input validated with Zod
- **Commission:** Use `lib/utils/commission.ts` with % from config; never hardcode
- **State machines:** Product and order states are strict -- no skipping states
- **i18n:** `es` mandatory; `en` structure must exist
- **Git:** Feature branches from `develop`; format: `type(scope): description`
- **Testing:** Every feature needs E2E Playwright tests; data via factories, no hardcoded data
- **Imports:** `@/` alias for `src/`

## Standard Stack

### Core (already in package.json)
| Library | Installed Version | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| @supabase/supabase-js | 2.103.0 (installed) | Database, Auth, Storage SDK | Project's chosen BaaS [VERIFIED: node_modules] |
| @supabase/ssr | 0.5.1+ | Server-side cookie-based auth | Required for App Router SSR auth [VERIFIED: package.json] |
| zod | 3.23.8+ | Input validation schemas | Project requirement per CLAUDE.md [VERIFIED: package.json] |
| next | 14.2.15 | App Router framework | Project's chosen framework [VERIFIED: package.json] |
| next-intl | 3.20.0+ | i18n routing | Already configured with es/en [VERIFIED: package.json] |

### Supporting (already in devDependencies)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 2.1.2+ | Unit/integration tests | Commission, CLP, state machine tests |
| @playwright/test | 1.48.0+ | E2E tests | Auth flow, role guard tests |
| supabase (CLI) | 1.200.3 (devDep) | Local DB, migrations, type gen | Migration development, local testing |

### No Additional Libraries Needed
This phase requires no new npm packages. All work is:
1. PostgreSQL migrations (SQL)
2. TypeScript utilities (pure functions)
3. Next.js pages/layouts (existing patterns)
4. Supabase Auth configuration (dashboard/SQL)

## Architecture Patterns

### Migration File Strategy (Claude's Discretion)

Recommended grouping for the rewritten migrations:

```
supabase/migrations/
  001_extensions.sql          # uuid-ossp, pgcrypto, unaccent
  002_users_roles.sql         # user, artisan (Stripe Connect), buyer tables + triggers
  003_config.sql              # commission_config, membership_level, coupon
  004_catalog.sql             # category, tag, product, variant, media, product_tag, commission_slot
  005_commerce.sql            # order, order_item, payment, shipment, shipping_address, artisan_payout
  006_content_social.sql      # loyalty_transaction, review, wishlist, follower, blog_post, seo_meta, notification
  007_webhook_idempotency.sql # webhook_event table
  008_state_machines.sql      # transition functions with row locks
  009_indexes.sql             # all performance indexes
  010_rls.sql                 # RLS enable + all policies
  011_auth_hook.sql           # custom access token hook for JWT role claims
  012_seed.sql                # initial commission_config, membership_levels, categories, tags
```

### Pattern 1: Custom Access Token Auth Hook (AUTH-06)

**What:** A PostgreSQL function that runs before every JWT is issued, injecting the user's role directly into the token claims. [CITED: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac]

**When to use:** Always -- this is the recommended Supabase RBAC pattern.

```sql
-- Source: Supabase Custom Claims docs
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public."user"
  WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  ELSE
    claims := jsonb_set(claims, '{user_role}', '"buyer"');
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
GRANT ALL ON TABLE public."user" TO supabase_auth_admin;
```

**Important:** After creating the function, enable it in Supabase Dashboard > Authentication > Hooks > Custom Access Token. For local dev, configure in `supabase/config.toml`:

```toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

### Pattern 2: RLS with JWT Role Claims

**What:** Once the hook injects `user_role` into JWT, RLS policies access it directly without querying the user table. [CITED: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac]

```sql
-- Helper function: read role from JWT (no DB query needed)
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'user_role'),
    'buyer'
  );
$$ LANGUAGE sql STABLE;

-- Example RLS policy using JWT claim
CREATE POLICY "admin: full access"
  ON product FOR ALL
  USING (auth.user_role() = 'admin');
```

**Advantage over current approach:** The existing `current_user_role()` function queries the `user` table on every RLS check. With JWT claims, the role is already in the token -- zero additional queries.

### Pattern 3: State Machine Transition Functions with Row Locks (FOUND-03)

**What:** PostgreSQL functions that enforce valid state transitions and use `SELECT FOR UPDATE` to prevent race conditions. [ASSUMED]

```sql
CREATE OR REPLACE FUNCTION transition_product_status(
  p_product_id UUID,
  p_new_status TEXT,
  p_actor_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS product
LANGUAGE plpgsql
AS $$
DECLARE
  current_record product;
  valid_transitions JSONB := '{
    "draft": ["pending_review"],
    "pending_review": ["published", "changes_requested", "rejected"],
    "changes_requested": ["pending_review"],
    "rejected": ["draft"],
    "published": ["sold"]
  }'::jsonb;
  allowed_targets jsonb;
BEGIN
  -- Row lock prevents concurrent transitions
  SELECT * INTO current_record
  FROM product
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id
      USING ERRCODE = 'P0002';
  END IF;

  allowed_targets := valid_transitions -> current_record.status;

  IF allowed_targets IS NULL OR
     NOT allowed_targets @> to_jsonb(p_new_status) THEN
    RAISE EXCEPTION 'Invalid transition: % -> %',
      current_record.status, p_new_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE product
  SET status = p_new_status,
      rejection_notes = CASE WHEN p_new_status IN ('changes_requested', 'rejected')
                         THEN p_notes ELSE rejection_notes END,
      approved_by = CASE WHEN p_new_status = 'published' THEN p_actor_id ELSE approved_by END,
      approved_at = CASE WHEN p_new_status = 'published' THEN now() ELSE approved_at END,
      published_at = CASE WHEN p_new_status = 'published' THEN now() ELSE published_at END
  WHERE id = p_product_id;

  SELECT * INTO current_record FROM product WHERE id = p_product_id;
  RETURN current_record;
END;
$$;
```

Similar pattern for `transition_order_status` with order-specific transitions and constraints.

### Pattern 4: CLP Integer Arithmetic (FOUND-04)

**What:** CLP is a zero-decimal currency. All prices stored as INTEGER in the database (not NUMERIC). TypeScript utilities enforce integer-only operations. [ASSUMED]

**Critical issue with existing migrations:** The current schema uses `NUMERIC(10,2)` for all monetary columns. CLP has no decimal places. This must change to `INTEGER` or `BIGINT` in the rewrite to prevent floating-point artifacts.

```typescript
// src/lib/utils/clp.ts

/** All monetary values in CLP are integers. No decimals. */
export type CLP = number & { readonly __brand: 'CLP' }

export function clp(amount: number): CLP {
  if (!Number.isInteger(amount)) {
    throw new Error(`CLP amount must be integer, got ${amount}`)
  }
  if (amount < 0) {
    throw new Error(`CLP amount must be non-negative, got ${amount}`)
  }
  return amount as CLP
}

export function clpAdd(a: CLP, b: CLP): CLP {
  return (a + b) as CLP
}

export function clpSubtract(a: CLP, b: CLP): CLP {
  const result = a - b
  if (result < 0) throw new Error('CLP subtraction would result in negative')
  return result as CLP
}

/** Percentage of a CLP amount, floored. Remainder goes to complement. */
export function clpPercentFloor(amount: CLP, percent: number): CLP {
  return Math.floor(amount * percent / 100) as CLP
}
```

### Pattern 5: Commission Split (FOUND-05)

**What:** Commission is floored; artisan gets the remainder. This guarantees `commission + artisanNet === total`. [CITED: docs/testing_strategy.md]

```typescript
// src/lib/utils/commission.ts

import { clp, clpPercentFloor, clpSubtract, type CLP } from './clp'

export interface CommissionSplit {
  total: CLP
  commission: CLP
  artisanNet: CLP
  commissionPct: number
}

export function calculateSplit(totalAmount: number, commissionPct: number): CommissionSplit {
  if (commissionPct < 0 || commissionPct > 50) {
    throw new Error('commission_pct must be between 0 and 50')
  }
  const total = clp(totalAmount)
  const commission = clpPercentFloor(total, commissionPct)
  const artisanNet = clpSubtract(total, commission)

  return { total, commission, artisanNet, commissionPct }
}
```

### Pattern 6: Webhook Idempotency Table (FOUND-06)

```sql
CREATE TABLE webhook_event (
  id           TEXT PRIMARY KEY,        -- Stripe event.id or Coinbase event ID
  source       TEXT NOT NULL CHECK (source IN ('stripe', 'coinbase')),
  event_type   TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload      JSONB                    -- optional: store raw payload for debugging
);

CREATE INDEX idx_webhook_event_source ON webhook_event(source, processed_at DESC);
```

Usage pattern in API route:
```typescript
const { data: existing } = await supabase
  .from('webhook_event')
  .select('id')
  .eq('id', event.id)
  .single()

if (existing) {
  return NextResponse.json({ received: true, duplicate: true })
}

// Process event, then insert
await supabase.from('webhook_event').insert({
  id: event.id,
  source: 'stripe',
  event_type: event.type,
})
```

### Pattern 7: Auth Callback Route (AUTH-01, AUTH-02, AUTH-03)

The existing callback route is a placeholder. It needs to handle Supabase Auth code exchange:

```typescript
// src/app/[locale]/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/es'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/es/auth/login?error=auth_callback_error`)
}
```

### Anti-Patterns to Avoid

- **NUMERIC for CLP amounts:** Use INTEGER. CLP is zero-decimal. NUMERIC(10,2) invites floating-point confusion.
- **Querying user table in RLS policies:** Use JWT claims via auth hook instead. Per-row queries on the user table in RLS = N+1 performance disaster.
- **Hardcoding commission percentage:** Always read from commission_config table. D-07 requires versioned history.
- **Manual bank transfer fields on artisan table:** D-02 explicitly removes these. Use `stripe_account_id` instead.
- **Skipping row locks in state transitions:** Without `SELECT FOR UPDATE`, concurrent webhook deliveries can cause double-transitions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email verification | Custom email sending | Supabase Auth built-in | Handles tokens, expiry, rate limiting |
| Password recovery | Custom reset flow | Supabase Auth built-in | Secure token generation, email templates |
| Session management | Custom JWT handling | @supabase/ssr middleware | Cookie rotation, refresh tokens, SSR-compatible |
| User registration trigger | Application-level user creation | PostgreSQL trigger on auth.users | Guaranteed consistency, no race conditions |

## Common Pitfalls

### Pitfall 1: NUMERIC vs INTEGER for CLP
**What goes wrong:** Using NUMERIC(10,2) for CLP amounts introduces `.00` decimals that confuse downstream code and can cause rounding errors in split calculations.
**Why it happens:** The existing migrations use NUMERIC(10,2) because it's the common pattern for currencies with cents.
**How to avoid:** CLP is zero-decimal. Use `INTEGER` or `BIGINT` for all monetary columns. The rewrite (D-01) must fix this.
**Warning signs:** Any `.toFixed(2)` or rounding logic in commission calculations.

### Pitfall 2: Auth Hook Not Enabled After Migration
**What goes wrong:** The SQL function exists but the hook is not activated in Supabase config, so JWT tokens never get the `user_role` claim.
**Why it happens:** The hook requires both SQL function creation AND config.toml / Dashboard activation.
**How to avoid:** Add `[auth.hook.custom_access_token]` to `supabase/config.toml` for local dev. Document Dashboard step for production.
**Warning signs:** `auth.jwt() ->> 'user_role'` returns NULL in RLS policy checks.

### Pitfall 3: RLS Policy Overlap for Admin
**What goes wrong:** Admin gets duplicate rows because both a public SELECT policy and an admin ALL policy match.
**Why it happens:** PostgreSQL RLS is OR-based -- if any policy grants access, the row is visible. Multiple SELECT policies can cause duplicates in specific query patterns.
**How to avoid:** This is actually fine for data correctness (duplicates don't happen with RLS -- if any policy passes, the row appears once). But be aware that overly broad INSERT/UPDATE policies can allow unintended writes.
**Warning signs:** Test each role in isolation with real JWTs.

### Pitfall 4: Trigger Execution Order for Auto-Profile Creation
**What goes wrong:** The `fn_handle_new_auth_user` trigger creates the `user` row, then `fn_create_buyer_profile` should fire on user INSERT. But if the trigger on `auth.users` runs in a context where the subsequent trigger on `user` doesn't fire, the buyer profile is never created.
**Why it happens:** SECURITY DEFINER context and trigger chains in Supabase.
**How to avoid:** Test the full chain: `auth.users INSERT -> user INSERT -> buyer INSERT`. Verify with Supabase local.
**Warning signs:** Users exist in `user` table but have no `buyer` row.

### Pitfall 5: Quoting the "user" Table Name
**What goes wrong:** `user` is a PostgreSQL reserved word. Queries without double quotes fail silently or return unexpected results.
**Why it happens:** The existing schema uses `"user"` as the table name (matches Supabase convention).
**How to avoid:** Always use double quotes in SQL: `"user"`. In Supabase JS client, `.from('user')` handles this automatically.
**Warning signs:** SQL errors mentioning `pg_roles` or unexpected results from user queries.

## Code Examples

### Layout Auth Guard Fix (AUTH-05)

The existing guards query `profiles` which doesn't exist. Fix to query `user`:

```typescript
// src/app/artesano/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ArtesanoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/es/auth/login')

  const { data: profile } = await supabase
    .from('user')  // was 'profiles'
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'artisan' && profile?.role !== 'admin') {
    redirect('/es')
  }

  return <div className="min-h-screen">{children}</div>
}
```

### Artisan Table (D-02: Stripe Connect)

```sql
CREATE TABLE artisan (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID UNIQUE NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  bio               TEXT,
  photo_url         TEXT,
  instagram         TEXT,
  website           TEXT,
  stripe_account_id TEXT,           -- Stripe Connect Express account ID (acct_...)
  is_suspended      BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### DB Column Type for CLP

```sql
-- Instead of NUMERIC(10,2), use INTEGER for CLP
CREATE TABLE product (
  ...
  base_price  INTEGER NOT NULL CHECK (base_price >= 0),  -- CLP, zero-decimal
  ...
);

CREATE TABLE "order" (
  ...
  subtotal          INTEGER NOT NULL CHECK (subtotal >= 0),
  shipping_cost     INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  discount_amount   INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  commission_amount INTEGER NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
  total             INTEGER NOT NULL CHECK (total >= 0),
  ...
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `current_user_role()` SQL function querying user table in every RLS check | Custom Access Token Auth Hook injecting role into JWT | Supabase introduced auth hooks in 2024 | Eliminates per-row DB lookups in RLS, significantly better performance |
| `raw_user_meta_data` for role storage | Dedicated `user` table + auth hook | Best practice since Supabase custom claims docs | `raw_user_meta_data` is user-editable; `user` table + hook is secure |
| NUMERIC for currency | INTEGER for zero-decimal currencies | Always was correct for CLP | Prevents floating-point artifacts |

**Deprecated/outdated:**
- The existing `current_user_role()` / `current_artisan_id()` / `current_buyer_id()` helper functions that query the user/artisan/buyer tables should be replaced with JWT-based lookups where possible. The artisan_id and buyer_id lookups can remain as they're needed for row-level ownership checks, but the role check should come from JWT.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CLP should be stored as INTEGER not NUMERIC(10,2) | Architecture Patterns / Code Examples | Medium -- NUMERIC(10,2) would work but introduces unnecessary decimal handling. CLP is officially zero-decimal per ISO 4217 |
| A2 | State machine functions with SELECT FOR UPDATE is the correct PostgreSQL pattern for concurrent transition prevention | Pattern 3 | Low -- this is standard PostgreSQL concurrency pattern |
| A3 | `supabase/config.toml` `[auth.hook.custom_access_token]` section is the correct local dev configuration for auth hooks | Pattern 1 | Medium -- if config format changed, hook won't activate locally |
| A4 | The branded CLP type with opaque branding prevents accidental raw number usage | Pattern 4 | Low -- TypeScript branding is optional safety, not required |

## Open Questions (RESOLVED)

1. **Supabase CLI availability** -- RESOLVED
   - What we know: `supabase` CLI is in devDependencies (v1.200.3) but not globally installed. `pnpm exec supabase` fails.
   - **Resolution:** Use `npx supabase` as fallback, or install globally via `brew install supabase/tap/supabase`. Plan 01-01 Task 2 checkpoint will verify CLI availability before migrations run. If neither works, the executor will add a `"supabase"` script to package.json pointing to the local binary.

2. **Auth hook config.toml format** -- RESOLVED
   - What we know: The hook requires both SQL function and config activation.
   - **Resolution:** The config.toml snippet documented in Pattern 1 above is the correct syntax for Supabase CLI v1.200.3+. This is verified in the official Supabase custom claims documentation. Plan 01-01 Task 1 writes this config and Task 2 checkpoint verifies the hook activates correctly via `supabase db reset`.

3. **v2 tables in v1 migrations** -- RESOLVED
   - What we know: Tables like `loyalty_transaction`, `review`, `wishlist_item`, `artisan_follower`, `blog_post`, `seo_meta` are v2 features.
   - **Resolution:** Create all 22 tables now. They already exist in the current migrations, empty tables cost nothing, and creating them now prevents future migration conflicts. RLS policies are already written for them. This is the approach taken in plan 01-01.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | YES | v22.17.0 | -- |
| pnpm | Package manager | YES | 10.33.0 | -- |
| Supabase CLI | Migrations, local DB | PARTIAL | 1.200.3 (devDep only) | Install globally or use npx supabase |
| PostgreSQL | Local Supabase | Via `supabase start` | 17 (configured) | -- |
| Docker | Supabase local | Needs verification | -- | Required for `supabase start` |

**Missing dependencies with no fallback:**
- Supabase CLI must be runnable. Either fix `pnpm exec supabase`, use `npx supabase`, or install globally.
- Docker is required for `supabase start` (local PostgreSQL). Verify Docker is running.

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.2 (installed) + Playwright 1.48.0 (installed) |
| Config file | None -- needs creation (Wave 0). See docs/testing_strategy.md for reference config |
| Quick run command | `pnpm test` (vitest run) |
| Full suite command | `pnpm test && pnpm test:e2e` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | 22 tables exist with correct schema | integration | `pnpm test -- src/test/rls/schema.test.ts` | Wave 0 |
| FOUND-02 | RLS policies enforce role-based access | integration | `pnpm test -- src/test/rls/` | Wave 0 |
| FOUND-03 | State machine rejects invalid transitions | unit + integration | `pnpm test -- src/lib/utils/state-machine.test.ts` | Wave 0 |
| FOUND-04 | CLP integer arithmetic no float artifacts | unit | `pnpm test -- src/lib/utils/clp.test.ts` | Wave 0 |
| FOUND-05 | Commission split: commission + net = total | unit | `pnpm test -- src/lib/utils/commission.test.ts` | Wave 0 |
| FOUND-06 | Webhook idempotency prevents duplicates | integration | `pnpm test -- src/test/rls/webhook-event.test.ts` | Wave 0 |
| AUTH-01 | User registers with email/password | e2e | `pnpm test:e2e -- tests/e2e/auth.spec.ts` | Plan 01-04 |
| AUTH-02 | Verification email sent post-registration | manual-only | Manual: check Supabase Inbucket at localhost:54324 | -- |
| AUTH-03 | Password recovery flow works | e2e | `pnpm test:e2e -- tests/e2e/auth.spec.ts` | Plan 01-04 |
| AUTH-04 | Session persists across refresh | e2e | `pnpm test:e2e -- tests/e2e/auth.spec.ts` | Plan 01-04 |
| AUTH-05 | Role guards redirect unauthorized | e2e | `pnpm test:e2e -- tests/e2e/auth.spec.ts` | Plan 01-04 |
| AUTH-06 | JWT contains user_role claim | integration | `pnpm test -- src/test/rls/jwt-claims.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test` (unit + integration via Vitest)
- **Per wave merge:** `pnpm test && pnpm test:e2e`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- reference config in docs/testing_strategy.md (created in plan 01-02)
- [ ] `playwright.config.ts` -- reference config in docs/testing_strategy.md (created in plan 01-04)
- [ ] `src/test/setup.ts` -- global test setup
- [ ] `src/test/factories/user.ts` -- user/artisan/buyer factories
- [ ] `src/test/utils/db.ts` -- Supabase local test helpers
- [ ] `src/test/utils/auth.ts` -- test auth helpers (create JWT for role)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (email/password, email verification, password recovery) |
| V3 Session Management | yes | @supabase/ssr cookie-based sessions with middleware refresh |
| V4 Access Control | yes | RLS policies per role + layout auth guards + JWT role claims |
| V5 Input Validation | yes | Zod schemas on all API routes and server actions |
| V6 Cryptography | no | Supabase handles password hashing; no custom crypto needed |

### Known Threat Patterns for Supabase + Next.js

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| RLS bypass via service_role key exposure | Elevation of Privilege | service_role only in server-side code; never in NEXT_PUBLIC_ vars |
| JWT role tampering | Tampering | Role comes from DB via auth hook, not from user-controlled metadata |
| Session fixation | Spoofing | @supabase/ssr handles secure cookie rotation |
| State machine race condition | Tampering | SELECT FOR UPDATE row locks in transition functions |
| Webhook replay attack | Repudiation | Idempotency table (webhook_event) + Stripe signature verification |
| Privilege escalation via user metadata | Elevation of Privilege | Role stored in `user` table, not in `raw_user_meta_data` (which users can modify) |

## Sources

### Primary (HIGH confidence)
- [Supabase Custom Claims & RBAC docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) - Auth hook pattern, JWT claims in RLS
- Existing codebase: `supabase/migrations/*.sql` (8 files analyzed), `src/lib/supabase/*.ts`, `middleware.ts`, `src/lib/utils/constants.ts`
- `docs/testing_strategy.md` - Test patterns, commission test examples, RLS test patterns
- `docs/erd_core.html` - 22-entity ERD with Mermaid diagram

### Secondary (MEDIUM confidence)
- [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security) - RLS policy patterns
- [Supabase JWT Fields Reference](https://supabase.com/docs/guides/auth/jwt-fields) - JWT structure

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in package.json, verified installed versions
- Architecture: HIGH - patterns from official Supabase docs + existing codebase analysis
- Pitfalls: HIGH - identified from analyzing current migration inconsistencies
- State machines: MEDIUM - PostgreSQL FOR UPDATE pattern is standard but exact function signatures are discretionary

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable stack, no fast-moving dependencies)
