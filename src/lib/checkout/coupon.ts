// Phase 3 Plan 04 — Coupon validation (preview) + reservation (atomic).
// Preview es read-only (UI muestra discount tentativo).
// Reserve usa RPC con UPDATE condicional para evitar race condition vs uses_limit (D-15 fix).
import type { SupabaseClient } from '@supabase/supabase-js'

export type ValidateResult =
  | { valid: true; couponId: string; discount: number; discountType: 'percentage' | 'fixed' }
  | {
      valid: false
      reason: 'not_found' | 'inactive' | 'expired' | 'limit_reached' | 'min_order' | 'race_or_limit_reached'
    }

type CouponRow = {
  id: string
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  min_order: number | null
  uses_limit: number | null
  uses_count: number
  expires_at: string | null
  is_active: boolean
}

function calcDiscount(type: 'percentage' | 'fixed', value: number, subtotal: number): number {
  if (type === 'percentage') {
    return Math.floor((subtotal * value) / 100)
  }
  // fixed: cap al subtotal (D-14: discount no excede subtotal)
  return Math.min(value, subtotal)
}

/**
 * Read-only preview: NO incrementa uses_count. Usado por /api/checkout/coupon
 * cuando el comprador escribe el código y la UI muestra el descuento tentativo.
 */
export async function validateCoupon(
  code: string,
  subtotal: number,
  supabase: SupabaseClient
): Promise<ValidateResult> {
  const normalized = code.trim().toUpperCase()
  const { data, error } = await supabase
    .from('coupon')
    .select('id, code, discount_type, discount_value, min_order, uses_limit, uses_count, expires_at, is_active')
    .eq('code', normalized)
    .maybeSingle()

  if (error) return { valid: false, reason: 'not_found' }
  const row = data as CouponRow | null
  if (!row) return { valid: false, reason: 'not_found' }
  if (!row.is_active) return { valid: false, reason: 'inactive' }
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return { valid: false, reason: 'expired' }
  }
  if (row.uses_limit !== null && row.uses_count >= row.uses_limit) {
    return { valid: false, reason: 'limit_reached' }
  }
  if (row.min_order !== null && row.min_order > subtotal) {
    return { valid: false, reason: 'min_order' }
  }
  return {
    valid: true,
    couponId: row.id,
    discountType: row.discount_type,
    discount: calcDiscount(row.discount_type, row.discount_value, subtotal),
  }
}

/**
 * Atomic reservation via RPC `reserve_coupon` (UPDATE condicional con RETURNING).
 * Usado por /api/checkout/payment-intent ANTES de crear el PI — previene race
 * condition vs uses_limit. El webhook (Plan 05) NO re-incrementa uses_count;
 * solo asocia coupon_id a la order.
 *
 * TODO(phase-5): cleanup job para PIs abandonados (uses_count queda inflado).
 */
export async function reserveCoupon(
  code: string,
  subtotal: number,
  supabase: SupabaseClient
): Promise<ValidateResult> {
  const normalized = code.trim().toUpperCase()
  const { data, error } = await supabase.rpc('reserve_coupon', {
    p_code: normalized,
    p_subtotal: subtotal,
  })
  if (error) return { valid: false, reason: 'race_or_limit_reached' }
  const rows = (data ?? []) as Array<{ id: string; discount_type: 'percentage' | 'fixed'; discount_value: number }>
  if (rows.length === 0) {
    return { valid: false, reason: 'race_or_limit_reached' }
  }
  const row = rows[0]
  return {
    valid: true,
    couponId: row.id,
    discountType: row.discount_type,
    discount: calcDiscount(row.discount_type, row.discount_value, subtotal),
  }
}
