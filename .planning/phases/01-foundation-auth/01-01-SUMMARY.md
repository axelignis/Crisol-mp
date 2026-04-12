---
phase: 01-foundation-auth
plan: 01
subsystem: database
tags: [migrations, rls, stripe-connect, state-machines, webhook-idempotency]
dependency_graph:
  requires: []
  provides: [database-schema, rls-policies, state-machine-functions, auth-hook, webhook-idempotency]
  affects: [supabase/migrations/*, supabase/config.toml]
tech_stack:
  added: []
  patterns: [jwt-based-rls, row-lock-state-machines, append-only-config, integer-clp]
key_files:
  created:
    - supabase/migrations/002_users_roles.sql
    - supabase/migrations/006_content_social.sql
    - supabase/migrations/007_webhook_idempotency.sql
    - supabase/migrations/008_state_machines.sql
    - supabase/migrations/009_indexes.sql
    - supabase/migrations/010_rls.sql
    - supabase/migrations/011_auth_hook.sql
    - supabase/migrations/012_seed.sql
  modified:
    - supabase/migrations/001_extensions.sql
    - supabase/migrations/003_config.sql
    - supabase/migrations/004_catalog.sql
    - supabase/migrations/005_commerce.sql
    - supabase/config.toml
decisions:
  - INTEGER for all CLP monetary columns (not NUMERIC)
  - auth.user_role() reads JWT claim, not DB query
  - Stripe Connect Express model replaces manual bank transfer
  - State machine functions use SELECT FOR UPDATE row locks
  - Webhook idempotency via TEXT PK on event.id
metrics:
  duration: 6m
  completed: "2026-04-12T14:52:55Z"
  tasks_completed: 1
  tasks_total: 2
---

# Phase 01 Plan 01: Database Migrations Rewrite Summary

Complete 12-migration rewrite: Stripe Connect model, INTEGER CLP, JWT-based RLS with custom access token hook, state machine functions with row locks, webhook idempotency table.

## Task Results

| Task | Name | Status | Commit | Key Files |
|------|------|--------|--------|-----------|
| 1 | Rewrite all 12 migration files | Done | 8d7a1a6 | supabase/migrations/001-012, config.toml |
| 2 | Verify database starts and migrations apply | Checkpoint | - | Awaiting `supabase db reset` verification |

## What Changed

### Removed
- `002_users.sql` (old users with bank_ fields)
- `006_loyalty_content.sql` (replaced by 006_content_social.sql)
- `007_indexes.sql` (replaced by 009_indexes.sql)
- `008_triggers_rls.sql` (split into 006 triggers, 010 RLS, 011 auth hook)

### Created
- `002_users_roles.sql`: Stripe Connect model (stripe_account_id, no bank fields), slug column on artisan
- `007_webhook_idempotency.sql`: webhook_event table with source CHECK constraint
- `008_state_machines.sql`: transition_product_status + transition_order_status with FOR UPDATE
- `010_rls.sql`: All RLS policies using auth.user_role() (JWT-based, not DB query)
- `011_auth_hook.sql`: custom_access_token_hook injects user_role into JWT
- `012_seed.sql`: 10% commission, categories, tags

### Modified
- `003_config.sql`: INTEGER for free_shipping_threshold, points_to_clp_rate, coupon values
- `004_catalog.sql`: INTEGER base_price, price_modifier, commission_slot price; removed currency columns
- `005_commerce.sql`: INTEGER all monetary columns, commission_pct_snapshot, stripe_transfer_id, Stripe Connect payout model
- `supabase/config.toml`: Enabled custom_access_token hook

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **INTEGER CLP everywhere**: All monetary columns use INTEGER (not NUMERIC) per CLAUDE.md canonical CLP rule
2. **JWT-based RLS**: auth.user_role() reads from JWT claim injected by custom access token hook, eliminates per-query DB lookup for role
3. **Stripe Connect Express**: artisan.stripe_account_id replaces all bank_ fields; payment.stripe_transfer_id for Connect transfers
4. **Row-lock state machines**: FOR UPDATE prevents concurrent race conditions on status transitions
5. **Append-only commission**: commission_config is insert-only with effective_from for audit trail

## Self-Check: PENDING

Task 2 checkpoint blocks database verification. Migration file structure verified via grep checks.
