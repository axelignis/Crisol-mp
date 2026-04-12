---
phase: 01-foundation-auth
verified: 2026-04-12T14:45:00Z
status: gaps_found
score: 3/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "RLS policies return correct data for each role when queried with real JWTs — verified by integration tests on every table"
    status: failed
    reason: "No RLS integration tests exist. Roadmap SC-3 explicitly requires integration tests covering every table with real JWT roles. Only E2E auth tests (auth.spec.ts) and CLP/commission unit tests exist. No test exercises PostgREST queries with artisan/buyer/admin JWTs and asserts correct row filtering."
    artifacts:
      - path: "tests/e2e/auth.spec.ts"
        issue: "Covers auth UI flows only, no RLS data policy assertions"
    missing:
      - "Create tests/integration/rls.test.ts (or equivalent) that exercises SELECT/INSERT/UPDATE/DELETE on key tables (product, order, artisan, buyer, user, webhook_event) with real JWT tokens for each role and asserts correct access behavior"

  - truth: "After registration, user is redirected to homepage with verification banner"
    status: failed
    reason: "VerificationBanner component exists at src/components/ui/verification-banner.tsx and auth-form.tsx redirects to /es?verified=false, but the component is never imported or rendered anywhere. Neither the homepage (src/app/[locale]/page.tsx) nor the locale layout includes VerificationBanner. The banner is orphaned — it cannot appear."
    artifacts:
      - path: "src/components/ui/verification-banner.tsx"
        issue: "Component exported but never imported by any page or layout"
      - path: "src/app/[locale]/page.tsx"
        issue: "Homepage renders a static placeholder; does not read searchParams or render VerificationBanner"
    missing:
      - "Add VerificationBanner to src/app/[locale]/page.tsx (or locale layout) so it renders when ?verified=false is present in URL"

  - truth: "Auth callback route exchanges code for session correctly"
    status: partial
    reason: "Code exchange works (exchangeCodeForSession is wired), but the 'next' query parameter is used without validation (CR-01 from code review). An attacker can craft /es/auth/callback?code=VALID&next=https://evil.com to redirect authenticated users to external malicious sites. The fix is a two-line relative-path check. This is a security vulnerability that blocks phase sign-off."
    artifacts:
      - path: "src/app/[locale]/auth/callback/route.ts"
        issue: "Line 7: 'next' param not validated as relative path before use in NextResponse.redirect"
    missing:
      - "Add relative-path validation: const isRelative = next.startsWith('/') && !next.startsWith('//'); const safeNext = isRelative ? next : '/es'"

  - truth: "Auth user insert trigger creates user + buyer/artisan profile"
    status: partial
    reason: "Trigger creates user row on auth.users INSERT, but reads 'role' from raw_user_meta_data (CR-02 from code review). A malicious client can call signUp({ data: { role: 'admin' } }) and receive admin role in the user table, which the JWT hook then propagates to RLS claims. This grants full admin RLS bypass to any registrant."
    artifacts:
      - path: "supabase/migrations/002_users_roles.sql"
        issue: "Line 105: COALESCE(NEW.raw_user_meta_data->>'role', 'buyer') — client-supplied role is trusted. Must hardcode 'buyer'."
    missing:
      - "Fix fn_handle_new_auth_user trigger to hardcode 'buyer' role instead of reading from raw_user_meta_data"
---

# Phase 1: Foundation & Auth Verification Report

**Phase Goal:** Every table exists with enforced RLS, users can register and authenticate with role-based access, and core utilities (CLP arithmetic, commission calculation, state machines, webhook idempotency) are validated
**Verified:** 2026-04-12T14:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | A new user can register with email/password, receive a verification email, and log in with a persisted session | PARTIAL | Registration wired (signUp) and callback route (exchangeCodeForSession) exist. Open redirect bug in callback (CR-01) is unpatched security issue. VerificationBanner orphaned (never rendered). |
| SC-2 | A user with role "artisan" can access /artesano; role "admin" can access /admin; unauthorized users redirected | VERIFIED | Both layouts query `public.user` table for role, redirect to /es/auth/login if unauthenticated, /es if wrong role. |
| SC-3 | RLS policies return correct data for each role when queried with real JWTs — verified by integration tests on every table | FAILED | No integration tests exist. Only E2E auth UI tests and unit tests. Zero tests exercise RLS policies with real JWT tokens. |
| SC-4 | Commission calculation produces integer CLP values where commission + artisan net = exact total, with no floating-point artifacts | VERIFIED | 21 unit tests pass (12 CLP, 9 commission). Property test covers 800+ input combinations. calculateSplit guarantees commission + artisanNet === total. |
| SC-5 | State machine transition functions reject invalid state changes and use row locks to prevent race conditions | VERIFIED | transition_product_status and transition_order_status in migration 008 use `FOR UPDATE` row locks. ERRCODE P0001 on invalid transition. |

**Score:** 3/5 truths verified (SC-2, SC-4, SC-5 pass; SC-1 partial; SC-3 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/002_users_roles.sql` | user, artisan (Stripe Connect), buyer tables + triggers | STUB (security flaw) | stripe_account_id present, no bank_ fields. Trigger reads role from raw_user_meta_data — role escalation vector (CR-02). |
| `supabase/migrations/007_webhook_idempotency.sql` | webhook_event table | VERIFIED | webhook_event table with source CHECK constraint (stripe/coinbase) and TEXT PK. |
| `supabase/migrations/008_state_machines.sql` | transition_product_status, transition_order_status with FOR UPDATE | VERIFIED | Both functions exist with FOR UPDATE row locks and ERRCODE P0001/P0002. |
| `supabase/migrations/010_rls.sql` | RLS policies for all tables using auth.user_role() | PARTIAL | RLS enabled on 27 tables. Function defined as `public.user_role()` (not `auth.user_role()` as planned — different schema, functionally equivalent since Supabase can't create functions in auth schema). Uses JWT claim correctly. No `current_user_role()` present. |
| `supabase/migrations/011_auth_hook.sql` | Custom access token hook for JWT role claims | VERIFIED | custom_access_token_hook reads role from public.user table and injects into JWT claims. Correct grants to supabase_auth_admin. |
| `src/lib/utils/clp.ts` | CLP branded type and integer arithmetic | VERIFIED | Exports CLP, clp, clpAdd, clpSubtract, clpMultiply, clpPercentFloor. No parseFloat, toFixed. |
| `src/lib/utils/clp.test.ts` | Unit tests for CLP utility | VERIFIED | 12 tests covering construction, arithmetic, edge cases. |
| `src/lib/utils/commission.ts` | Commission split calculation | VERIFIED | Imports from clp.ts. calculateSplit with 0-50% validation. |
| `src/lib/utils/commission.test.ts` | Unit tests for commission split | VERIFIED | 9 tests including property test across 800+ combinations. |
| `vitest.config.ts` | Vitest configuration | VERIFIED | defineConfig with @ alias. All 21 tests pass. |
| `src/app/[locale]/auth/login/page.tsx` | Login page with split-screen layout | VERIFIED | Uses SplitScreenLayout and AuthForm mode="login". |
| `src/app/[locale]/auth/registro/page.tsx` | Registration page with split-screen layout | VERIFIED | Uses SplitScreenLayout and AuthForm mode="register". |
| `src/app/[locale]/auth/recuperar/page.tsx` | Password recovery page | VERIFIED | Uses SplitScreenLayout and AuthForm mode="recover". |
| `src/app/[locale]/auth/callback/route.ts` | Auth code exchange route | PARTIAL | exchangeCodeForSession wired. Open redirect vulnerability: `next` param not validated (CR-01). |
| `src/app/artesano/layout.tsx` | Artisan role guard | VERIFIED | Queries `.from('user').select('role')`, no 'profiles' reference. Allows artisan or admin. |
| `src/app/admin/layout.tsx` | Admin role guard | VERIFIED | Queries `.from('user').select('role')`, no 'profiles' reference. Allows admin only. |
| `src/components/auth/split-screen-layout.tsx` | Reusable split-screen auth layout | VERIFIED | lg:grid-cols-2 grid, brand hero on left, form on right. |
| `src/components/ui/verification-banner.tsx` | Verification banner for post-registration | ORPHANED | Component exports VerificationBanner with correct text, but is never imported anywhere. Auth-form redirects to /es?verified=false but banner never renders. |
| `playwright.config.ts` | Playwright test runner configuration | VERIFIED | defineConfig with baseURL localhost:3000, chromium, webServer auto-start. |
| `tests/e2e/auth.spec.ts` | E2E tests for auth flows | VERIFIED (code) | 7 tests covering registration, login, recovery, role guard redirects. Tests verified correct via code review. Cannot confirm execution without running dev server + supabase. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `supabase/migrations/011_auth_hook.sql` | `supabase/config.toml` | auth.hook.custom_access_token config | WIRED | config.toml has `[auth.hook.custom_access_token]` with `enabled = true` |
| `supabase/migrations/010_rls.sql` | JWT claim | public.user_role() reads JWT via auth.jwt() | WIRED | Function uses `auth.jwt() ->> 'user_role'`, not DB query. 26 policy references. |
| `src/app/[locale]/auth/registro/page.tsx` | Supabase Auth | supabase.auth.signUp | WIRED | Line 42 in auth-form.tsx |
| `src/app/[locale]/auth/login/page.tsx` | Supabase Auth | supabase.auth.signInWithPassword | WIRED | Line 30 in auth-form.tsx |
| `src/app/[locale]/auth/callback/route.ts` | Supabase Auth | supabase.auth.exchangeCodeForSession | WIRED (with security flaw) | Code exchange works but next param unvalidated |
| `src/app/artesano/layout.tsx` | public.user table | supabase.from('user').select('role') | WIRED | Line 13-16 |
| `src/lib/utils/commission.ts` | `src/lib/utils/clp.ts` | import { clp, clpPercentFloor, clpSubtract, type CLP } | WIRED | Line 1 |
| `src/components/ui/verification-banner.tsx` | Homepage / locale layout | Rendered when ?verified=false | NOT WIRED | Banner never imported; homepage has no searchParams reading |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `verification-banner.tsx` | useSearchParams `verified` param | URL query string | N/A — never rendered | HOLLOW_PROP |
| `auth-form.tsx` | error, loading state | Supabase auth responses | Yes | FLOWING |
| `artesano/layout.tsx` | profile.role | Supabase DB query on user table | Yes | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for migrations (no runnable entry points). Unit tests verified programmatically.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CLP tests pass | `pnpm vitest run src/lib/utils/clp.test.ts` | 12/12 tests passing | PASS |
| Commission tests pass | `pnpm vitest run src/lib/utils/commission.test.ts` | 9/9 tests passing | PASS |
| 12 migration files exist | `ls supabase/migrations/*.sql \| wc -l` | 12 | PASS |
| RLS on all tables | Count ENABLE ROW LEVEL SECURITY statements | 27 tables | PASS |
| auth hook in config | grep in config.toml | Found `[auth.hook.custom_access_token]` | PASS |
| E2E test files exist | file existence check | playwright.config.ts + tests/e2e/auth.spec.ts present | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FOUND-01 | 01-01 | Database schema completo (22 entidades) con migraciones forward-only | SATISFIED | 12 migrations in supabase/migrations/, 27 tables with RLS |
| FOUND-02 | 01-01 | RLS activo en toda tabla con políticas por rol | SATISFIED | 27 ALTER TABLE ... ENABLE ROW LEVEL SECURITY statements in 010_rls.sql |
| FOUND-03 | 01-01 | Funciones de transición de estado con row locks | SATISFIED | transition_product_status + transition_order_status with FOR UPDATE |
| FOUND-04 | 01-02 | Utilidad CLP como moneda zero-decimal | SATISFIED | clp.ts with branded type, integer-only enforcement, 12 passing tests |
| FOUND-05 | 01-02 | Commission.ts con cálculo entero comisión + neto = total exacto | SATISFIED | calculateSplit proven by property test across 800+ inputs; 9 passing tests |
| FOUND-06 | 01-01 | Tabla de idempotencia para webhooks | SATISFIED | webhook_event table in 007_webhook_idempotency.sql with TEXT PK and source CHECK |
| AUTH-01 | 01-03, 01-04 | User puede registrarse con email y contraseña | SATISFIED | signUp wired in auth-form.tsx; E2E test covers registration happy path |
| AUTH-02 | 01-03, 01-04 | User recibe verificación de email tras registro | NEEDS HUMAN | Supabase Auth sends verification email automatically; VerificationBanner that should display post-registration is orphaned (never rendered) |
| AUTH-03 | 01-03, 01-04 | User puede recuperar contraseña vía email | SATISFIED | resetPasswordForEmail wired; recuperar page renders |
| AUTH-04 | 01-03 | Sesión persiste entre refreshes del navegador | NEEDS HUMAN | Middleware uses @supabase/ssr cookie refresh; session persistence requires browser test to confirm |
| AUTH-05 | 01-03, 01-04 | Guards por rol en layouts | SATISFIED | artesano/layout.tsx and admin/layout.tsx both query user table for role |
| AUTH-06 | 01-01 | JWT claims incluyen rol del usuario | SATISFIED | custom_access_token_hook injects user_role into JWT; public.user_role() reads it in RLS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/[locale]/auth/callback/route.ts` | 7 | Open redirect: unvalidated `next` param in redirect | BLOCKER | Security: authenticated users can be redirected to attacker-controlled URLs after login |
| `supabase/migrations/002_users_roles.sql` | 105 | Role escalation: `COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')` trusts client input | BLOCKER | Security: any registrant can claim 'admin' role via signUp({ data: { role: 'admin' } }) |
| `src/components/ui/verification-banner.tsx` | entire file | Component created but never imported or rendered | BLOCKER | Goal: "user is redirected to homepage with verification banner" cannot be observed |
| `src/types/database.types.ts` | 21 | `stripe_onboarded: boolean` does not exist in migration 002; type drift | WARNING | TypeScript allows writing non-existent column; runtime failure when querying it |
| `src/components/auth/auth-form.tsx` | 36, 55 | `setLoading(false)` not called on success paths (login, register) | WARNING | UX: button stuck in "Cargando..." state on successful login until navigation completes |
| `src/components/auth/auth-form.tsx` | 36, 55, 154 | Hardcoded `/es` locale in all navigation paths | WARNING | i18n: English-locale users (/en/*) redirected to Spanish pages after auth |
| `supabase/migrations/012_seed.sql` | entire file | Seed data in numbered migration (forward-only) | WARNING | Operational: cannot change initial categories/tags without a new migration |
| `tests/e2e/auth.spec.ts` | 36 | `waitForTimeout(2000)` anti-pattern | INFO | Flaky tests: fixed wait instead of condition-based wait |
| `src/components/auth/split-screen-layout.tsx` | 1 | Unnecessary `'use client'` directive | INFO | Bundle size: pure presentational component forces client bundle |

### Human Verification Required

#### 1. Session Persistence (AUTH-04)

**Test:** Log in with a valid account, then navigate away, close and reopen the browser tab, and return to a protected route like /artesano.
**Expected:** User remains authenticated and can access the protected route without being redirected to login.
**Why human:** Session persistence via httpOnly cookies requires a real browser environment with cookie storage. Cannot verify from static code analysis alone.

#### 2. Email Verification Flow (AUTH-02)

**Test:** Register a new account. Check local Supabase Inbucket at http://localhost:54324 for the verification email. Click the verification link.
**Expected:** Email arrives in Inbucket, link redirects through /es/auth/callback, and session is established.
**Why human:** Requires Supabase running locally and mail delivery to Inbucket — cannot verify programmatically.

#### 3. E2E Tests Pass Against Running Dev Server

**Test:** With `supabase start` running and `pnpm dev` active, run `pnpm test:e2e -- tests/e2e/auth.spec.ts`.
**Expected:** All 7 tests pass (registration happy path, registration error, login page render, login error, recovery page, artesano guard, admin guard).
**Why human:** E2E tests require dev server + local Supabase. Tests were verified correct via code review but execution was blocked in the AI environment.

### Gaps Summary

Four gaps block phase goal achievement:

**1. RLS integration tests missing (SC-3)** — The roadmap success criteria explicitly requires "verified by integration tests on every table." No such tests exist. Only CLP/commission unit tests and auth E2E UI tests are present. This is the most critical gap because SC-3 is a specific roadmap contract that cannot be waived without a formal override.

**2. VerificationBanner orphaned (SC-1, AUTH-02)** — The post-registration flow redirects to `?verified=false` but the banner component is never imported anywhere. Users registering will see no feedback about email verification. Two-line fix: import and render `<VerificationBanner />` in the homepage or locale layout.

**3. Open redirect in callback (CR-01)** — Security vulnerability where attacker-crafted `?next=https://evil.com` redirects authenticated users externally. Two-line fix in route.ts to validate relative path.

**4. Role escalation in registration trigger (CR-02)** — Any user can register with `{ data: { role: 'admin' } }` and receive admin access via RLS. One-line fix to hardcode `'buyer'` in the trigger instead of reading from `raw_user_meta_data`.

Gaps 3 and 4 are security vulnerabilities identified in the code review (01-REVIEW.md) that remain unfixed. Gaps 1 and 2 are goal-achievement failures.

---

_Verified: 2026-04-12T14:45:00Z_
_Verifier: Claude (gsd-verifier)_
