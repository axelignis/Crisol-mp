// Phase 3 Plan 04 — Coupon validation (preview) + checkout validation (read-only).
// CR-02 fix: la incrementacion de uses_count NO ocurre al crear el PaymentIntent;
// se mueve a la creacion atomica de la orden (RPC create_order_from_snapshot,
// migracion 023) para que solo cuenten usos efectivos.
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
 * Pre-checkout validation (read-only, CR-02). Llamada por
 * /api/checkout/payment-intent ANTES de crear el PI. NO incrementa
 * uses_count: esto evita inflar el contador con PIs abandonados.
 *
 * El uses_count++ se ejecuta atomicamente dentro de la RPC
 * `create_order_from_snapshot` (migracion 023) cuando la orden se
 * crea efectivamente. Esa misma RPC re-valida la disponibilidad
 * con FOR UPDATE para garantizar que el limite no se sobrepase
 * bajo concurrencia, asi que esta funcion solo necesita ser
 * read-only.
 *
 * Reutiliza validateCoupon — la firma se mantiene como wrapper
 * para no obligar a cambios en callers que prefieran la semantica
 * "for-checkout".
 */
export async function validateCouponForCheckout(
  code: string,
  subtotal: number,
  supabase: SupabaseClient
): Promise<ValidateResult> {
  return validateCoupon(code, subtotal, supabase)
}

/**
 * @deprecated CR-02: usar `validateCouponForCheckout`. Mantenido como
 * alias temporal hasta que se migre a la nueva RPC; ahora ya NO
 * incrementa uses_count (era inseguro, inflaba el contador con PIs
 * abandonados). El incremento atomico se hace en
 * `create_order_from_snapshot`.
 */
export async function reserveCoupon(
  code: string,
  subtotal: number,
  supabase: SupabaseClient
): Promise<ValidateResult> {
  return validateCouponForCheckout(code, subtotal, supabase)
}
