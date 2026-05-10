/**
 * Phase 3 Plan 05 — Create order transaccionalmente desde
 * payment_intent.succeeded.
 *
 * Flujo (ejecutado por /api/webhooks/stripe con service_role bypass RLS):
 *  1. Carga `cart_snapshot` por id (en pi.metadata.cart_snapshot_id).
 *  2. Decrementa stock atomicamente via RPC `decrement_stock_atomic`.
 *  3. Inserta `order` (status default = pending_payment).
 *  4. Inserta `order_item[]` con snapshot_title + unit_price inmutables.
 *  5. Inserta `shipping_address` (snapshot inmutable).
 *  6. Inserta `shipment[]` (uno por artesano).
 *  7. Inserta `payment` (method=stripe, stripe_transfer_id=null per D-SPLIT).
 *  8. Inserta `artisan_payout[]` (uno por artesano, status='pending').
 *  9. Llama RPC `transition_order_status(id, 'paid', null)` — NO UPDATE directo.
 *
 * D-SPLIT (single-account): NO `stripe.transfers.create`, NO transfer_data.
 * Plataforma cobra 100% al buyer; payouts manuales fuera de Stripe.
 *
 * D-15 (discount absorbido por plataforma): artisan_net intacto.
 *
 * COUPON: ya reservado en Plan 04 (`reserveCoupon` UPDATE atomico via RPC
 * reserve_coupon). El webhook NO incrementa uses_count — solo asocia coupon_id
 * a la orden. Esto evita doble-incremento.
 *
 * Errores propagados al caller (route.ts):
 *  - NO_SNAPSHOT_ID: pi.metadata sin cart_snapshot_id.
 *  - SNAPSHOT_NOT_FOUND: snapshot expirado o id invalido.
 *  - StockInsufficientError: alguna variante quedo bajo cero (race extrema).
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

type StripeWebhookEvent = Stripe.Event | { id: string; type: string; data: { object: Stripe.PaymentIntent | Record<string, unknown> } }

type StagedPerArtisan = {
  artisanId: string
  subtotal: number
  shipping: number
  commission: number
  artisanNet: number
}

type StagedPerItem = {
  variantId: string
  productId: string
  artisanId: string
  qty: number
  unitPrice: number
  totalPrice: number
  snapshotTitle: string
}

type StagedLedger = {
  artisanId: string
  gross: number
  commissionGross: number
  discountAbsorbedByCommission: number
  shippingClp: number
  netToArtisan: number
}

type CartSnapshotRow = {
  id: string
  email: string | null
  buyer_id: string | null
  payload: {
    email: string
    buyer_id: string | null
    items: Array<{ variantId: string; qty: number }>
    address: {
      fullName: string
      line1: string
      line2?: string
      city: string
      region: string
      countryCode: 'CL'
      postalCode?: string
      phone?: string
    }
    shipments: Array<{ artisanId: string; courier: 'chilexpress' | 'starken' | 'flat_rate'; costClp: number }>
    couponCode?: string
    acceptedDisclaimers: true
  }
  totals: {
    subtotal: number
    discount: number
    shippingTotal: number
    commission: number
    commissionPct?: number
    total: number
    perArtisan: StagedPerArtisan[]
    perItem: StagedPerItem[]
    ledger: StagedLedger[]
    couponId?: string | null
  }
}

export type CreateOrderFromPaymentInput = {
  event: StripeWebhookEvent
  supabase: SupabaseClient
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

  // 1. Load snapshot
  const { data: snapRaw, error: snapErr } = await supabase
    .from('cart_snapshot')
    .select('*')
    .eq('id', snapshotId)
    .single()
  if (snapErr || !snapRaw) {
    throw new Error('SNAPSHOT_NOT_FOUND')
  }
  const snap = snapRaw as CartSnapshotRow

  // 2. Decrement stock atomically (RPC con FOR UPDATE)
  const { data: stockRows, error: stockErr } = await supabase.rpc(
    'decrement_stock_atomic',
    { p_items: snap.payload.items as unknown as object },
  )
  if (stockErr) {
    throw new Error(`stock_rpc_error: ${stockErr.message}`)
  }
  const rows = (stockRows ?? []) as Array<{
    variant_id: string
    available: number
    requested: number
    ok: boolean
  }>
  const insufficientRows = rows.filter((r) => !r.ok)
  if (insufficientRows.length > 0) {
    throw new StockInsufficientError(
      insufficientRows.map((r) => ({
        variantId: r.variant_id,
        available: r.available,
        requested: r.requested,
      })),
    )
  }

  // 3. Resolver buyer.id si el snapshot tiene buyer_id (auth user_id)
  let buyerRowId: string | null = null
  const authUserId = snap.payload.buyer_id ?? snap.buyer_id
  if (authUserId) {
    const { data: buyerRow } = await supabase
      .from('buyer')
      .select('id')
      .eq('user_id', authUserId)
      .maybeSingle()
    buyerRowId = (buyerRow as { id: string } | null)?.id ?? null
  }

  // 4. Insert order
  const orderInsert = {
    buyer_id: buyerRowId,
    guest_email: buyerRowId ? null : snap.payload.email,
    subtotal: snap.totals.subtotal,
    shipping_cost: snap.totals.shippingTotal,
    discount_amount: snap.totals.discount,
    commission_amount: snap.totals.commission,
    commission_pct_snapshot: snap.totals.commissionPct ?? null,
    total: snap.totals.total,
    coupon_id: snap.totals.couponId ?? null,
  }
  const { data: orderData, error: orderErr } = await supabase
    .from('order')
    .insert(orderInsert)
    .select()
    .single()
  if (orderErr || !orderData) {
    throw new Error(`order_insert_failed: ${orderErr?.message ?? 'no data'}`)
  }
  const orderId = (orderData as { id: string }).id

  // 5. Insert order_item — uno por entry en perItem
  const itemRows = snap.totals.perItem.map((it) => ({
    order_id: orderId,
    product_id: it.productId,
    variant_id: it.variantId,
    artisan_id: it.artisanId,
    quantity: it.qty,
    unit_price: it.unitPrice,
    total_price: it.totalPrice,
    snapshot_title: it.snapshotTitle,
  }))
  const { error: itErr } = await supabase.from('order_item').insert(itemRows)
  if (itErr) {
    throw new Error(`order_item_insert_failed: ${itErr.message}`)
  }

  // 6. Insert shipping_address (snapshot inmutable)
  const addr = snap.payload.address
  const { error: addrErr } = await supabase.from('shipping_address').insert({
    order_id: orderId,
    full_name: addr.fullName,
    address_line1: addr.line1,
    address_line2: addr.line2 ?? null,
    city: addr.city,
    state_province: addr.region,
    country_code: addr.countryCode,
    postal_code: addr.postalCode ?? null,
    phone: addr.phone ?? null,
  })
  if (addrErr) {
    throw new Error(`shipping_address_insert_failed: ${addrErr.message}`)
  }

  // 7. Insert shipment — uno por artesano (cada uno gestiona su despacho)
  const shipmentRows = snap.payload.shipments.map((s) => ({
    order_id: orderId,
    artisan_id: s.artisanId,
    // 'flat_rate' no es un courier valido en la tabla shipment; mapeamos al
    // proveedor por defecto. La columna se actualiza cuando el artesano envia.
    courier: s.courier === 'flat_rate' ? 'chilexpress' : s.courier,
    status: 'pending',
  }))
  const { error: shipErr } = await supabase.from('shipment').insert(shipmentRows)
  if (shipErr) {
    throw new Error(`shipment_insert_failed: ${shipErr.message}`)
  }

  // 8. Insert payment (D-SPLIT: stripe_transfer_id=null, method=stripe)
  const totalArtisanNet = snap.totals.perArtisan.reduce((s, a) => s + a.artisanNet, 0)
  const { error: payErr } = await supabase.from('payment').insert({
    order_id: orderId,
    method: 'stripe',
    stripe_payment_intent_id: pi.id,
    stripe_transfer_id: null,
    amount: snap.totals.total,
    artisan_net: totalArtisanNet,
    commission_amount: snap.totals.commission,
    status: 'paid',
    paid_at: new Date().toISOString(),
  })
  if (payErr) {
    throw new Error(`payment_insert_failed: ${payErr.message}`)
  }

  // 9. Insert artisan_payout — uno por artesano (status='pending', single-account)
  // period_from/period_to: ventana del dia para registro contable; se ajusta
  // cuando el admin liquide manualmente. gross/commission/net del ledger.
  const today = new Date().toISOString().slice(0, 10)
  const payoutRows = snap.totals.ledger.map((l) => ({
    artisan_id: l.artisanId,
    period_from: today,
    period_to: today,
    gross_amount: l.gross,
    commission_amount: l.commissionGross,
    net_amount: l.netToArtisan,
    stripe_payout_id: null,
    stripe_transfer_ids: null,
    status: 'pending',
    notes: `order:${orderId}`,
  }))
  const { error: poErr } = await supabase.from('artisan_payout').insert(payoutRows)
  if (poErr) {
    throw new Error(`artisan_payout_insert_failed: ${poErr.message}`)
  }

  // 10. Transition order: pending_payment -> paid (RPC, no UPDATE directo)
  const { error: trErr } = await supabase.rpc('transition_order_status', {
    p_order_id: orderId,
    p_new_status: 'paid',
    p_actor_id: null,
  })
  if (trErr) {
    throw new Error(`order_transition_failed: ${trErr.message}`)
  }

  return { orderId }
}
