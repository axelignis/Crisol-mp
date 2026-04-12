# Phase 1: Foundation & Auth - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 01-foundation-auth
**Areas discussed:** Migration strategy, Role onboarding, Auth pages UX, Commission config

---

## Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite from scratch | Drop all 8 migrations, rewrite cleanly aligned with current spec | ✓ |
| Fix incrementally | Keep existing, add new migrations to fix inconsistencies | |
| Keep schema, replace RLS/triggers | Keep 001-007, rewrite 008, add new for missing pieces | |

**User's choice:** Rewrite from scratch
**Notes:** Existing migrations have inconsistencies with actual project spec (profiles vs user, bank transfers vs Stripe Connect)

### Follow-up: Artisan Payout Model

| Option | Description | Selected |
|--------|-------------|----------|
| Stripe Connect | Express accounts, automatic splits, remove bank fields | ✓ |
| Manual bank transfers | Admin receives all, transfers manually, keep bank fields | |
| Hybrid | Start manual, migrate to Stripe Connect later | |

**User's choice:** Stripe Connect
**Notes:** Remove bank transfer fields, add stripe_account_id

---

## Role Onboarding

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-only invitation | Only admin can create artisan accounts | ✓ |
| Application flow | Users apply, admin approves/rejects | |
| Pre-seeded + invite code | Initial artisans pre-seeded, future via invite code | |

**User's choice:** Admin-only invitation

### Follow-up: Creation Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Admin creates account directly | Admin enters email+name, system sends invite with password setup | ✓ |
| Admin promotes existing user | Person registers as buyer first, admin changes role | |
| You decide | Claude picks | |

**User's choice:** Admin creates account directly

---

## Auth Pages UX

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal functional | Clean form, logo, basic validation | |
| Branded split-screen | Hero image left, auth form right | ✓ |
| Single card centered | Centered card with subtle brand elements | |

**User's choice:** Branded split-screen

### Follow-up: Post-Registration Redirect

| Option | Description | Selected |
|--------|-------------|----------|
| Verification pending page | "Check your email" page, can't browse until verified | |
| Homepage with banner | Redirect to catalog, show "verify email" banner, can browse but not buy | ✓ |
| You decide | Claude picks | |

**User's choice:** Homepage with banner

---

## Commission Config

| Option | Description | Selected |
|--------|-------------|----------|
| DB table with history | commission_config with effective_from, orders snapshot active rate | ✓ |
| Single DB row + audit log | One row + separate audit_log table | |
| You decide | Claude picks | |

**User's choice:** DB table with history

### Follow-up: Initial Rate

| Option | Description | Selected |
|--------|-------------|----------|
| 15% | Common for artisan marketplaces | |
| 10% | Lower take rate, attractive for family members | ✓ |
| 20% | Higher end, covers costs faster | |

**User's choice:** 10%

---

## Claude's Discretion

- Exact split-screen image selection and brand copy
- RLS policy naming conventions
- State machine function signatures
- CLP utility API design
- Migration file numbering and grouping

## Deferred Ideas

None
