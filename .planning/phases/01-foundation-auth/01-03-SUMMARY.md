---
phase: 01-foundation-auth
plan: 03
subsystem: auth
tags: [supabase-auth, split-screen-layout, role-guards, next-intl, rls]

requires:
  - phase: 01-01
    provides: "Database schema with user table, artisan, buyer, webhook_event tables"
  - phase: 01-02
    provides: "CLP utilities and commission split logic"
provides:
  - "Auth pages (login, register, recover) with branded split-screen layout"
  - "Auth callback route for code-to-session exchange"
  - "Role-based layout guards querying user table"
  - "Verification banner for post-registration flow"
  - "database.types.ts with webhook_event table tracked in repo"
affects: [02-catalog, 03-commerce, artisan-dashboard, admin-panel]

tech-stack:
  added: []
  patterns:
    - "Split-screen auth layout pattern (SplitScreenLayout component)"
    - "AuthForm multi-mode pattern (login/register/recover via mode prop)"
    - "Role guard pattern querying public.user table in server layout"

key-files:
  created:
    - src/components/auth/split-screen-layout.tsx
    - src/components/auth/auth-form.tsx
    - src/components/ui/verification-banner.tsx
    - src/app/[locale]/auth/recuperar/page.tsx
  modified:
    - src/app/[locale]/auth/login/page.tsx
    - src/app/[locale]/auth/registro/page.tsx
    - src/app/[locale]/auth/callback/route.ts
    - src/app/artesano/layout.tsx
    - src/app/admin/layout.tsx
    - src/types/database.types.ts
    - .gitignore

key-decisions:
  - "Track database.types.ts in repo (removed from .gitignore) since supabase CLI not available for generation"
  - "Added webhook_event table manually to database.types.ts to match migration 007"
  - "Generic error messages in AuthForm to prevent user enumeration (T-03-03)"

patterns-established:
  - "SplitScreenLayout: reusable branded layout for all auth pages"
  - "AuthForm: single component handling login/register/recover via mode prop"
  - "Role guard: server layout queries public.user.role, redirects on mismatch"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05]

duration: 3min
completed: 2026-04-12
---

# Phase 01 Plan 03: Auth Pages & Role Guards Summary

**Supabase auth pages with branded split-screen layout, password recovery, auth callback, and role-based layout guards querying user table**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-12T15:28:03Z
- **Completed:** 2026-04-12T15:31:11Z
- **Tasks:** 2 of 2 auto tasks completed (Task 3 is human-verify checkpoint)
- **Files modified:** 11

## Accomplishments
- Login, register, and password recovery pages with branded split-screen layout (D-05)
- Auth callback route exchanging codes for Supabase sessions
- Artisan and admin layout guards fixed to query 'user' table instead of 'profiles'
- Verification banner for post-registration redirect flow (D-06)
- database.types.ts updated with webhook_event table and tracked in repo

## Task Commits

Each task was committed atomically:

1. **Task 1: Auth components, split-screen layout, verification banner, webhook_event types** - `86dc890` (feat)
2. **Task 2: Auth pages, callback route, layout guard fixes** - `2c779f6` (feat)

## Files Created/Modified
- `src/components/auth/split-screen-layout.tsx` - Branded split-screen layout with Crisol hero
- `src/components/auth/auth-form.tsx` - Multi-mode auth form (login/register/recover)
- `src/components/ui/verification-banner.tsx` - Post-registration email verification banner
- `src/app/[locale]/auth/login/page.tsx` - Login page with SplitScreenLayout
- `src/app/[locale]/auth/registro/page.tsx` - Registration page with SplitScreenLayout
- `src/app/[locale]/auth/recuperar/page.tsx` - Password recovery page
- `src/app/[locale]/auth/callback/route.ts` - Auth code exchange route
- `src/app/artesano/layout.tsx` - Fixed to query 'user' table
- `src/app/admin/layout.tsx` - Fixed to query 'user' table
- `src/types/database.types.ts` - Added webhook_event table type
- `.gitignore` - Removed database.types.ts from ignore list

## Decisions Made
- Tracked database.types.ts in repo because supabase CLI binary not installed (postinstall didn't run). Removed from .gitignore.
- Added webhook_event table manually to types file to match migration 007 schema.
- Used generic error messages ("Credenciales incorrectas") per threat model T-03-03 to prevent user enumeration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Supabase CLI not available for type generation**
- **Found during:** Task 1 (database type regeneration)
- **Issue:** `supabase` CLI binary not installed (npm postinstall script didn't run), cannot run `pnpm db:types`
- **Fix:** Manually added webhook_event table type to existing database.types.ts to match migration 007. Removed file from .gitignore to track in repo.
- **Files modified:** src/types/database.types.ts, .gitignore
- **Verification:** File contains stripe_account_id and webhook_event, build passes
- **Committed in:** 86dc890 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix to unblock type generation. database.types.ts should be fully regenerated when supabase CLI becomes available.

## Issues Encountered
None beyond the supabase CLI availability noted in deviations.

## User Setup Required
None - no external service configuration required for this plan.

## Next Phase Readiness
- Auth flow complete: registration, login, password recovery, session persistence
- Role guards protect /artesano and /admin routes
- Ready for catalog/product management features that depend on auth
- Note: database.types.ts should be regenerated with `pnpm db:types` once supabase CLI is installed

## Self-Check: PASSED

All 10 files verified present. Both task commits (86dc890, 2c779f6) verified in git log. Build passes without errors.

---
*Phase: 01-foundation-auth*
*Completed: 2026-04-12*
