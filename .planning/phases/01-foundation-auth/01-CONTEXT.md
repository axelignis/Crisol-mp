# Phase 1: Foundation & Auth - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete database schema (22 entities) with enforced RLS policies per role, user authentication with role-based access guards, and core utilities: CLP integer arithmetic, commission calculation with versioned config, state machine transition functions with row locks, and webhook idempotency table.

</domain>

<decisions>
## Implementation Decisions

### Migration Strategy
- **D-01:** Rewrite all 8 existing migrations from scratch — current migrations have inconsistencies (layout references `profiles` table that doesn't exist, artisan table has manual bank transfer fields incompatible with Stripe Connect model)
- **D-02 (SUPERSEDED 2026-05-09 by Phase 3 D-SPLIT):** ~~Artisan payout model is Stripe Connect (Express accounts) — remove all manual bank transfer fields (bank_name, bank_account_type, bank_account_number, bank_rut, bank_email) from artisan table. Add stripe_account_id instead.~~ Stripe Connect Separate Charges & Transfers no está disponible en Chile. Phase 3 adopta single-account model con liquidación manual vía `artisan_payout`. El campo `artisan.stripe_account_id` queda nullable y sin uso (no eliminar para evitar migración destructiva); los campos de banco (bank_name, bank_rut, bank_email, etc.) deben **restaurarse** en Phase 3 vía nueva migración para soportar la liquidación manual del admin. Ver `.planning/phases/03-commerce/03-CONTEXT.md` D-SPLIT.

### Role Onboarding
- **D-03:** Admin-only artisan creation — no public artisan registration. Fits the family marketplace model (4-6 initial artisans).
- **D-04:** Admin creates artisan account directly from admin panel (enters email + name), system sends invitation email with password setup link. Artisans never go through buyer registration.

### Auth Pages UX
- **D-05:** Branded split-screen layout for login/register pages — left side: hero image of artisan jewelry + brand messaging; right side: auth form. Sets marketplace tone from first interaction.
- **D-06:** After registration, redirect to homepage (catalog) with persistent banner: "Verifica tu email para comprar". Buyers can browse but cannot checkout until email is verified.

### Commission Configuration
- **D-07:** Commission stored in DB table with history — commission_config table with effective_from date. Each change inserts a new row. Orders snapshot the active rate at payment time. Admin edits via panel.
- **D-08:** Initial commission percentage is 10%.

### Claude's Discretion
- Exact split-screen image selection and brand copy
- RLS policy naming conventions
- State machine function signatures and error messages
- CLP utility API design (function names, parameter order)
- Migration file numbering and grouping strategy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database & Schema
- `docs/erd_core.html` — Full 22-entity ERD with relationships, constraints, and column definitions
- `docs/architecture.html` — System architecture, Supabase integration patterns, service boundaries

### Auth & Flows
- `docs/flow_purchase.html` — Purchase flow including auth requirements at checkout
- `docs/flow_split_payment.html` — Split payment flow showing Stripe Connect integration

### State Machines
- `docs/flow_publication.html` — Product publication state machine (draft → pending_review → published)
- `src/lib/utils/constants.ts` — PRODUCT_STATUSES and ORDER_STATUSES already defined

### Project Structure
- `docs/project_structure.md` — Directory layout, naming conventions, file organization
- `docs/testing_strategy.md` — Testing approach, E2E requirements

### API
- `docs/api_spec.html` — API endpoints spec including webhook signatures

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase/server.ts` — Server-side Supabase client with cookie handling (keep as-is)
- `src/lib/supabase/client.ts` — Browser-side Supabase client (keep as-is)
- `src/lib/supabase/middleware.ts` — Session refresh in middleware (keep as-is)
- `src/lib/utils/constants.ts` — PRODUCT_STATUSES, ORDER_STATUSES, USER_ROLES already defined
- `middleware.ts` — i18n + session refresh already wired

### Established Patterns
- Supabase Auth with cookie-based sessions via `@supabase/ssr`
- Layout-level auth guards (server component, redirect on unauthorized)
- TypeScript strict mode, path alias `@/` → `src/`

### Integration Points
- `src/app/artesano/layout.tsx` — Needs fix: queries `profiles` (should be `user` table)
- `src/app/admin/layout.tsx` — Same fix needed
- `src/lib/utils/commission.ts` — Empty placeholder, needs implementation
- `supabase/migrations/` — Will be completely rewritten per D-01

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for implementation details.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation-auth*
*Context gathered: 2026-04-12*
