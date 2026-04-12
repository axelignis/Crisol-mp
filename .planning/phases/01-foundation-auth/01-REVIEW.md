---
phase: 01-foundation-auth
reviewed: 2026-04-12T18:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - .gitignore
  - playwright.config.ts
  - src/app/[locale]/auth/callback/route.ts
  - src/app/[locale]/auth/login/page.tsx
  - src/app/[locale]/auth/recuperar/page.tsx
  - src/app/[locale]/auth/registro/page.tsx
  - src/app/admin/layout.tsx
  - src/app/artesano/layout.tsx
  - src/components/auth/auth-form.tsx
  - src/components/auth/split-screen-layout.tsx
  - src/components/ui/verification-banner.tsx
  - src/lib/utils/clp.test.ts
  - src/lib/utils/clp.ts
  - src/lib/utils/commission.test.ts
  - src/lib/utils/commission.ts
  - src/lib/supabase/server.ts
  - src/lib/supabase/client.ts
  - src/types/database.types.ts
  - supabase/config.toml
  - supabase/migrations/001_extensions.sql
  - supabase/migrations/002_users_roles.sql
  - supabase/migrations/003_config.sql
  - supabase/migrations/004_catalog.sql
  - supabase/migrations/005_commerce.sql
  - supabase/migrations/006_content_social.sql
  - supabase/migrations/007_webhook_idempotency.sql
  - supabase/migrations/008_state_machines.sql
  - supabase/migrations/009_indexes.sql
  - supabase/migrations/010_rls.sql
  - supabase/migrations/011_auth_hook.sql
  - supabase/migrations/012_seed.sql
  - tests/e2e/auth.spec.ts
  - vitest.config.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-12T18:00:00Z
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Foundation auth phase includes: Supabase migrations (full schema with RLS), auth callback route, auth form component, role-guarded layouts, CLP arithmetic utilities, commission split logic, E2E tests, and config files. The database schema and RLS policies are well-structured. CLP/commission utilities are solid with good test coverage. Key issues: an open redirect vulnerability in the auth callback, a role-escalation vector in the user registration trigger, and several hardcoded locale paths that break i18n.

## Critical Issues

### CR-01: Open Redirect in Auth Callback

**File:** `src/app/[locale]/auth/callback/route.ts:7-13`
**Issue:** The `next` query parameter is used directly in `NextResponse.redirect()` without validation. An attacker can craft a URL like `/es/auth/callback?code=VALID&next=https://evil.com/phish` to redirect authenticated users to a malicious site after successful OAuth/magic-link authentication.
**Fix:**
```typescript
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/es'

  // Validate next is a relative path (no protocol, no //)
  const isRelative = next.startsWith('/') && !next.startsWith('//')
  const safeNext = isRelative ? next : '/es'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${origin}/es/auth/login?error=auth_callback_error`)
}
```

### CR-02: User Role Settable via Registration Metadata

**File:** `supabase/migrations/002_users_roles.sql:105`
**Issue:** The `fn_handle_new_auth_user()` trigger reads `role` from `raw_user_meta_data`: `COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')`. Supabase Auth allows clients to pass arbitrary `options.data` during `signUp()`. A malicious client can register with `{ data: { role: 'admin' } }` and get the `admin` role inserted into the `user` table. The JWT hook in migration 011 then propagates this role into JWT claims, granting full admin access via RLS policies.
**Fix:** Never trust client-supplied role. Hardcode `'buyer'` in the trigger:
```sql
CREATE OR REPLACE FUNCTION fn_handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "user" (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    'buyer'  -- ALWAYS default to buyer; admin promotes via DB
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Warnings

### WR-01: Hardcoded `/es` Locale in Auth Flows Breaks i18n

**File:** `src/components/auth/auth-form.tsx:36,55,61,154-175`
**Issue:** All navigation paths and links are hardcoded to `/es` (e.g., `router.push('/es')`, `href="/es/auth/recuperar"`). Users on the `/en` locale will be redirected to Spanish pages after login, registration, or password recovery. Same issue in `src/app/[locale]/auth/callback/route.ts:7,17` and both layout guards (`src/app/admin/layout.tsx:10,18`, `src/app/artesano/layout.tsx:10,19`).
**Fix:** Use the `locale` from the route params or `usePathname()` to construct locale-aware paths. For the callback route, extract locale from the URL path segment. For auth-form.tsx, accept locale as a prop or derive it from the current path.

### WR-02: database.types.ts Drifted from Migrations

**File:** `src/types/database.types.ts:22`
**Issue:** The auto-generated types include `stripe_onboarded: boolean` on the `artisan` table and are missing the `slug` column. Neither `stripe_onboarded` nor the absence of `slug` matches migration `002_users_roles.sql` which defines `slug TEXT UNIQUE` and no `stripe_onboarded` column. This type drift means TypeScript will allow writing `stripe_onboarded` (which will fail at runtime) and won't allow writing `slug` (which exists in DB). Run `pnpm db:types` to regenerate after applying all migrations.
**Fix:**
```bash
pnpm db:types
```

### WR-03: `setLoading(false)` Missing on Success Paths in AuthForm

**File:** `src/components/auth/auth-form.tsx:36-38,54-56`
**Issue:** In the `login` branch, `setLoading(false)` is never called on success -- the function calls `router.push` and `router.refresh()` then returns. If the navigation is slow or fails, the button stays in "Cargando..." state indefinitely. Same for the `register` branch (line 55). The `recover` branch correctly calls `setLoading(false)` on both success and error.
**Fix:** Add `setLoading(false)` in a `finally` block or after each success path:
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  setLoading(true)
  setError(null)
  setSuccess(null)

  try {
    const supabase = createClient()
    // ... existing logic ...
  } finally {
    setLoading(false)
  }
}
```

### WR-04: Seed Data in Migration File Instead of Seed File

**File:** `supabase/migrations/012_seed.sql`
**Issue:** Seed data (categories, tags, initial commission config) is in a numbered migration file. Migrations are forward-only and run in production. If seed data needs to change (e.g., adding/removing categories), you cannot edit this migration. The `supabase/config.toml` already configures `sql_paths = ["./seed.sql"]` for seeding during `db reset`. Move seed data to `supabase/seed.sql` instead.
**Fix:** Move the contents of `012_seed.sql` to `supabase/seed.sql` and remove the migration file (if not yet applied). Note: `003_config.sql` also has inline seed data (membership levels) -- consider moving that too.

### WR-05: RLS Policies Allow Unrestricted Order/Item/Address INSERT

**File:** `supabase/migrations/010_rls.sql:222-223,244-246,300-301`
**Issue:** Three policies use `WITH CHECK (true)` for INSERT: orders, order items, and shipping addresses. This means any authenticated user (or even anonymous if anon key is used) can insert arbitrary rows into these tables. For orders, `buyer_id` could be set to any buyer. For order items, `artisan_id` and prices could be manipulated. These INSERTs should be restricted to server-side operations (service_role) or validated with `WITH CHECK` constraints matching the authenticated user.
**Fix:** Either restrict INSERT to service_role only (remove the `WITH CHECK (true)` policies and handle creation via server actions using `service_role`), or add proper checks:
```sql
CREATE POLICY "order: buyer puede crear su propio pedido"
  ON "order" FOR INSERT
  WITH CHECK (buyer_id = current_buyer_id() OR buyer_id IS NULL);
```

## Info

### IN-01: `'use client'` Unnecessary on SplitScreenLayout

**File:** `src/components/auth/split-screen-layout.tsx:1`
**Issue:** `SplitScreenLayout` has no client-side hooks, state, or event handlers. It is a pure presentational component that could be a Server Component. The `'use client'` directive is unnecessary.
**Fix:** Remove the `'use client'` directive. The component will still work as a child of client components.

### IN-02: E2E Test Uses `waitForTimeout` Anti-Pattern

**File:** `tests/e2e/auth.spec.ts:37`
**Issue:** `await page.waitForTimeout(2000)` is a flaky test anti-pattern. It waits a fixed 2 seconds regardless of actual page state. The test description says "register with existing email shows error" but the test body uses a short password ("short") and checks the URL, not an error message.
**Fix:** Wait for a specific condition instead:
```typescript
// Wait for either an error message or for the URL to still be on registro
await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 5000 })
```

### IN-03: Redundant Indexes on Columns with UNIQUE Constraints

**File:** `supabase/migrations/009_indexes.sql:10-12`
**Issue:** `idx_user_email` on `"user"(email)` and `idx_artisan_slug` on `artisan(slug)` are redundant. PostgreSQL automatically creates a unique index for columns with `UNIQUE` constraints (defined in migration 002). Similarly, `idx_product_slug` and `idx_blog_slug` duplicate unique constraint indexes.
**Fix:** Remove the redundant index definitions to reduce write overhead:
```sql
-- Remove these (already covered by UNIQUE constraints):
-- CREATE INDEX idx_user_email    ON "user"(email);
-- CREATE INDEX idx_artisan_slug  ON artisan(slug);
-- CREATE INDEX idx_product_slug  ON product(slug);
-- CREATE INDEX idx_blog_slug     ON blog_post(slug);
```

---

_Reviewed: 2026-04-12T18:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
