// Phase 3 Plan 04 — Stage cart server-side antes de crear PaymentIntent.
// Stripe metadata limita a 500 chars/key, 50 keys → no se puede inlinear el
// carrito completo. Guardamos un snapshot y referenciamos su id en
// PaymentIntent.metadata.cart_snapshot_id. El webhook (Plan 05) lo lee.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CheckoutInput } from './totals'
import type { Totals } from './totals'

export type StageCartTotals = Totals & { couponId?: string | null }

export async function stageCart(
  supabase: SupabaseClient,
  input: CheckoutInput,
  totals: StageCartTotals
): Promise<string> {
  const { data, error } = await supabase
    .from('cart_snapshot')
    .insert({
      payload: input as unknown as Record<string, unknown>,
      totals: totals as unknown as Record<string, unknown>,
      email: input.email,
      buyer_id: input.buyer_id,
      // expires_at lo asigna el default (now() + 30 min) — no lo seteamos aquí
      // para permitir que la migración controle el TTL.
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`stageCart: ${error?.message ?? 'no data'}`)
  }
  return data.id as string
}
