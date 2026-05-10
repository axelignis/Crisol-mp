/**
 * Phase 3 / Plan 03-07 — Coupon fixture factory.
 *
 * Provee descriptores de cupones de seed (migración 017) y
 * helper para generar cupones nuevos. La suite E2E de cupón
 * usa los seeds canónicos: CRISOL10, BIENVENIDA, EXPIRADO.
 */
export type CouponFixture = {
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number // % (1-100) o monto en CLP
  min_order_clp: number | null
  starts_at: string | null
  ends_at: string | null
  uses_limit: number | null
  uses_count: number
  active: boolean
}

/** Cupón porcentaje 10% sin mínimo (seed canónico de pruebas manuales). */
export const COUPON_CRISOL10: CouponFixture = {
  code: 'CRISOL10',
  discount_type: 'percentage',
  discount_value: 10,
  min_order_clp: null,
  starts_at: null,
  ends_at: null,
  uses_limit: null,
  uses_count: 0,
  active: true,
}

/** Cupón con min_order alto (para reproducir min_order error). */
export const COUPON_BIENVENIDA: CouponFixture = {
  code: 'BIENVENIDA',
  discount_type: 'fixed',
  discount_value: 5000,
  min_order_clp: 30000,
  starts_at: null,
  ends_at: null,
  uses_limit: null,
  uses_count: 0,
  active: true,
}

/** Cupón ya expirado (ends_at en el pasado). */
export const COUPON_EXPIRADO: CouponFixture = {
  code: 'EXPIRADO',
  discount_type: 'percentage',
  discount_value: 50,
  min_order_clp: null,
  starts_at: null,
  ends_at: '2020-01-01T00:00:00Z',
  uses_limit: null,
  uses_count: 0,
  active: true,
}

export function buildCoupon(overrides: Partial<CouponFixture> = {}): CouponFixture {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return {
    code: overrides.code ?? `TEST${suffix}`,
    discount_type: overrides.discount_type ?? 'percentage',
    discount_value: overrides.discount_value ?? 10,
    min_order_clp: overrides.min_order_clp ?? null,
    starts_at: overrides.starts_at ?? null,
    ends_at: overrides.ends_at ?? null,
    uses_limit: overrides.uses_limit ?? null,
    uses_count: overrides.uses_count ?? 0,
    active: overrides.active ?? true,
  }
}
