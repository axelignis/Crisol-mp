// Stub RED.
export type ValidateResult =
  | { valid: true; couponId: string; discount: number; discountType: 'percentage' | 'fixed' }
  | { valid: false; reason: 'not_found' | 'inactive' | 'expired' | 'limit_reached' | 'min_order' | 'race_or_limit_reached' }

export async function validateCoupon(_code: string, _subtotal: number, _supabase: unknown): Promise<ValidateResult> {
  throw new Error('not implemented')
}

export async function reserveCoupon(_code: string, _subtotal: number, _supabase: unknown): Promise<ValidateResult> {
  throw new Error('not implemented')
}
