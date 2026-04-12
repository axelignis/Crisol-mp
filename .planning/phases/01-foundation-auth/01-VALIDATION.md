---
phase: 1
slug: foundation-auth
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.2 / playwright 1.48.0 |
| **Config file** | vitest.config.ts (plan 01-02), playwright.config.ts (plan 01-04) |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test && pnpm test:e2e` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test && pnpm test:e2e`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01 | 1 | FOUND-01, FOUND-02, FOUND-03, FOUND-06, AUTH-06 | T-01-01..T-01-06 | RLS on all tables, JWT role claims, row locks, idempotency | integration | `ls supabase/migrations/*.sql \| wc -l && grep -l "custom_access_token_hook" supabase/migrations/011_auth_hook.sql` | created by task | pending |
| 01-01-T2 | 01 | 1 | FOUND-01 | T-01-01 | All 12 migrations apply without error | integration | `supabase db reset 2>&1 \| tail -5` | n/a (checkpoint) | pending |
| 01-02-T1 | 02 | 1 | FOUND-04 | T-02-02 | CLP integer-only arithmetic, rejects floats/negatives | unit | `pnpm test -- src/lib/utils/clp.test.ts` | created by task | pending |
| 01-02-T2 | 02 | 1 | FOUND-05 | T-02-01 | commission + artisanNet === total for all inputs | unit | `pnpm test -- src/lib/utils/commission.test.ts` | created by task | pending |
| 01-03-T1 | 03 | 2 | AUTH-01, AUTH-02, AUTH-04 | T-03-04 | DB types regenerated, split-screen layout, auth form, verification banner | static | `grep -q "stripe_account_id" src/types/database.types.ts && grep -q "lg:grid-cols-2" src/components/auth/split-screen-layout.tsx` | created by task | pending |
| 01-03-T2 | 03 | 2 | AUTH-01, AUTH-03, AUTH-05 | T-03-01, T-03-02 | Auth pages, callback route, layout guards query 'user' table | static | `grep -q 'from..user' src/app/artesano/layout.tsx && grep -q "exchangeCodeForSession" src/app/\[locale\]/auth/callback/route.ts` | created by task | pending |
| 01-03-T3 | 03 | 2 | AUTH-01..AUTH-05 | T-03-01..T-03-05 | Full auth flow works end-to-end | e2e (manual) | `pnpm build 2>&1 \| tail -5` | n/a (checkpoint) | pending |
| 01-04-T1 | 04 | 3 | AUTH-01..AUTH-05 | T-04-01 | Playwright config + auth E2E tests created | e2e | `test -f playwright.config.ts && grep -q "registro" tests/e2e/auth.spec.ts` | created by task | pending |
| 01-04-T2 | 04 | 3 | AUTH-01..AUTH-05 | T-04-01 | All E2E auth tests pass | e2e | `pnpm test:e2e -- tests/e2e/auth.spec.ts` | depends on T1 | pending |

---

## Wave 0 Requirements

- [x] `vitest.config.ts` — vitest configuration (plan 01-02, Task 1)
- [x] `playwright.config.ts` — playwright configuration (plan 01-04, Task 1)
- [x] `tests/e2e/auth.spec.ts` — E2E auth tests (plan 01-04, Task 1)

*Test infrastructure is created by plans 01-02 and 01-04.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email verification flow | AUTH-02 | Requires email delivery | Register user, check Supabase Inbucket at localhost:54324 for email trigger |
| Supabase local environment | FOUND-01 | Requires Docker + Supabase CLI | Run `supabase start`, verify containers |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
