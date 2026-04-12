---
phase: 01-foundation-auth
fixed_at: 2026-04-12T18:30:00Z
review_path: .planning/phases/01-foundation-auth/01-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-04-12T18:30:00Z
**Source review:** .planning/phases/01-foundation-auth/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 6
- Skipped: 1

## Fixed Issues

### CR-01: Open Redirect in Auth Callback

**Files modified:** `src/app/[locale]/auth/callback/route.ts`
**Commit:** 1052473
**Applied fix:** Added validation that `next` query parameter is a relative path (starts with `/`, not `//`) before using it in redirect. Falls back to locale root if invalid.

### CR-02: User Role Settable via Registration Metadata

**Files modified:** `supabase/migrations/013_fix_role_escalation.sql`
**Commit:** 370b197
**Applied fix:** Created forward-only migration 013 that replaces `fn_handle_new_auth_user()` to hardcode `'buyer'` role instead of reading from `raw_user_meta_data`. New file created (cannot edit applied migrations).

### WR-01: Hardcoded `/es` Locale in Auth Flows Breaks i18n

**Files modified:** `src/components/auth/auth-form.tsx`, `src/app/[locale]/auth/callback/route.ts`, `src/app/[locale]/auth/login/page.tsx`, `src/app/[locale]/auth/registro/page.tsx`, `src/app/[locale]/auth/recuperar/page.tsx`, `src/app/admin/layout.tsx`, `src/app/artesano/layout.tsx`
**Commit:** 8a4859e
**Applied fix:** Added `locale` prop to AuthForm, passed from page params. Callback route extracts locale from route params. Layout guards use `DEFAULT_LOCALE` constant. All `/es` hardcoded paths replaced with dynamic locale interpolation.

### WR-03: `setLoading(false)` Missing on Success Paths in AuthForm

**Files modified:** `src/components/auth/auth-form.tsx`
**Commit:** 1e93b17
**Applied fix:** Wrapped `handleSubmit` body in `try/finally` block with `setLoading(false)` in `finally`, ensuring loading state resets on all code paths (success, error, exception).

### WR-04: Seed Data in Migration File Instead of Seed File

**Files modified:** `supabase/seed.sql` (created), `supabase/migrations/012_seed.sql` (removed)
**Commit:** f137dcb
**Applied fix:** Moved seed data (categories, tags, commission config) from numbered migration to `supabase/seed.sql`. The migration file was removed since it has not been applied to any shared environment.

### WR-05: RLS Policies Allow Unrestricted Order/Item/Address INSERT

**Files modified:** `supabase/migrations/010_rls.sql`
**Commit:** 332ed6e
**Applied fix:** Replaced `WITH CHECK (true)` on order, order_item, and shipping_address INSERT policies with buyer ownership checks via `current_buyer_id()`.

## Skipped Issues

### WR-02: database.types.ts Drifted from Migrations

**File:** `src/types/database.types.ts`
**Reason:** Fix requires running `pnpm db:types` which needs a running Supabase instance. Cannot be applied in CI/review context. Developer should run `pnpm db:types` after applying all migrations locally.
**Original issue:** Auto-generated types include `stripe_onboarded` and are missing `slug` column, causing runtime/type mismatches.

---

_Fixed: 2026-04-12T18:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
