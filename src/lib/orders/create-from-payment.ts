/**
 * Phase 3 Plan 05 — Create order transaccionalmente desde
 * payment_intent.succeeded.
 *
 * CR-01 fix: TODO el flujo (stock decrement, inserts, coupon increment,
 * transition) ocurre dentro de la RPC SQL `create_order_from_snapshot`
 * (migracion 023). El TS handler queda como wrapper delgado que invoca
 * la RPC y mapea `error_code` → exception tipada. Esto garantiza
 * atomicidad: si cualquier paso falla, todos los cambios se revierten.
 *
 * D-SPLIT (single-account): NO `stripe.transfers.create`, NO transfer_data.
 * Plataforma cobra 100% al buyer; payouts manuales fuera de Stripe.
 *
 * D-15 (discount absorbido por plataforma): artisan_net intacto.
 *
 * COUPON (CR-02): el incremento de uses_count ocurre AHORA dentro de la
 * misma RPC, no antes en /api/checkout/payment-intent. PIs abandonados
 * ya no inflan el contador.
 *
 * Errores propagados al caller (route.ts):
 *  - NO_SNAPSHOT_ID: pi.metadata sin cart_snapshot_id.
 *  - SnapshotNotFoundError: snapshot expirado o id invalido.
 *  - StockInsufficientError: alguna variante quedo bajo cero (race extrema).
 *    El webhook caller debe disparar refund automatico (CR-03).
 *  - CouponLimitReachedError: cupon agotado entre PI y order creation.
 *  - cualquier error de DB se propaga; el caller debe NO devolver 5xx
 *    (el pago ya succeeded; Stripe no debe reintentar).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Stripe } from 'stripe'

export class StockInsufficientError extends Error {
  constructor(
    public readonly insufficient: Array<{ variantId: string; available: number; requested: number }>,
  ) {
    super(`stock insufficient for ${insufficient.length} variant(s)`)
    this.name = 'StockInsufficientError'
  }
}

export class SnapshotNotFoundError extends Error {
  constructor(public readonly snapshotId: string) {
    super(`SNAPSHOT_NOT_FOUND: ${snapshotId}`)
    this.name = 'SnapshotNotFoundError'
  }
}

export class CouponLimitReachedError extends Error {
  constructor() {
    super('COUPON_LIMIT_REACHED')
    this.name = 'CouponLimitReachedError'
  }
}

type StripeWebhookEvent = Stripe.Event | { id: string; type: string; data: { object: Stripe.PaymentIntent | Record<string, unknown> } }

export type CreateOrderFromPaymentInput = {
  event: StripeWebhookEvent
  supabase: SupabaseClient
}

/**
 * Parsea el error_code 'STOCK_INSUFFICIENT:<variantId>:<available>:<requested>;...'
 * formateado por la RPC create_order_from_snapshot.
 */
function parseStockInsufficient(errorCode: string): Array<{
  variantId: string
  available: number
  requested: number
}> {
  const payload = errorCode.replace(/^STOCK_INSUFFICIENT:/, '')
  return payload
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const [variantId, available, requested] = entry.split(':')
      return {
        variantId,
        available: Number(available) || 0,
        requested: Number(requested) || 0,
      }
    })
}

export async function createOrderFromPayment({
  event,
  supabase,
}: CreateOrderFromPaymentInput): Promise<{ orderId: string }> {
  const pi = (event as { data: { object: { id: string; metadata?: Record<string, string> } } }).data
    .object
  const snapshotId = pi.metadata?.cart_snapshot_id
  if (!snapshotId) {
    throw new Error('NO_SNAPSHOT_ID')
  }

  // Wrapper delgado: toda la logica vive en la RPC create_order_from_snapshot.
  const { data, error } = await supabase.rpc('create_order_from_snapshot', {
    p_snapshot_id: snapshotId,
    p_pi_id: pi.id,
    p_pi_metadata: (pi.metadata ?? {}) as unknown as object,
  })

  if (error) {
    // SQLSTATE P0001 con mensaje 'COUPON_LIMIT_REACHED' viene como excepcion
    // de Postgres (la RPC hace RAISE). Otros errores se propagan tal cual.
    const msg = error.message ?? String(error)
    if (msg.includes('COUPON_LIMIT_REACHED')) {
      throw new CouponLimitReachedError()
    }
    throw new Error(`create_order_rpc_error: ${msg}`)
  }

  // La RPC retorna TABLE(order_id uuid, error_code text) → array de 1 fila.
  const rows = (data ?? []) as Array<{ order_id: string | null; error_code: string | null }>
  const row = rows[0]
  if (!row) {
    throw new Error('create_order_rpc_no_rows')
  }

  if (row.error_code) {
    if (row.error_code === 'SNAPSHOT_NOT_FOUND') {
      throw new SnapshotNotFoundError(snapshotId)
    }
    if (row.error_code.startsWith('STOCK_INSUFFICIENT:')) {
      throw new StockInsufficientError(parseStockInsufficient(row.error_code))
    }
    if (row.error_code === 'COUPON_LIMIT_REACHED') {
      throw new CouponLimitReachedError()
    }
    throw new Error(`create_order_rpc_unknown_error: ${row.error_code}`)
  }

  if (!row.order_id) {
    throw new Error('create_order_rpc_missing_order_id')
  }

  return { orderId: row.order_id }
}
