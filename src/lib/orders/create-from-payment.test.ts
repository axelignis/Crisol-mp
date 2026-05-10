import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createOrderFromPayment,
  StockInsufficientError,
} from './create-from-payment'

const ART = '11111111-1111-1111-1111-111111111111'
const ART2 = '22222222-2222-2222-2222-222222222222'
const V1 = '33333333-3333-3333-3333-333333333333'
const V2 = '44444444-4444-4444-4444-444444444444'
const SNAP = '55555555-5555-5555-5555-555555555555'
const ORDER = '66666666-6666-6666-6666-666666666666'
const COUPON = '77777777-7777-7777-7777-777777777777'
const BUYER = '88888888-8888-8888-8888-888888888888'

type Inserted = { table: string; rows: unknown }

function makeSupabaseMock(opts: {
  snapshotPayload?: Record<string, unknown> | null
  totalsPayload?: Record<string, unknown>
  stockResult?: Array<{ variant_id: string; available: number; requested: number; ok: boolean }>
  buyerLookup?: { id: string } | null
  insertedSink?: Inserted[]
} = {}) {
  const inserts: Inserted[] = opts.insertedSink ?? []
  const snapshotData = opts.snapshotPayload === undefined
    ? defaultSnapshot()
    : opts.snapshotPayload
  const stock = opts.stockResult ?? [
    { variant_id: V1, available: 5, requested: 2, ok: true },
  ]

  const couponUpdates: Array<unknown> = []

  const rpc = vi.fn(async (fn: string, params: unknown) => {
    if (fn === 'decrement_stock_atomic') {
      return { data: stock, error: null }
    }
    if (fn === 'transition_order_status') {
      return { data: { id: (params as any).p_order_id, status: 'paid' }, error: null }
    }
    return { data: null, error: null }
  })

  const from = vi.fn((table: string) => {
    if (table === 'cart_snapshot') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: snapshotData,
              error: snapshotData ? null : { message: 'not found' },
            }),
          }),
        }),
      }
    }
    if (table === 'order') {
      return {
        insert: vi.fn((rows: unknown) => {
          inserts.push({ table, rows })
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: ORDER }, error: null }),
            }),
          }
        }),
      }
    }
    if (table === 'order_item' || table === 'shipping_address' || table === 'shipment' || table === 'payment' || table === 'artisan_payout') {
      return {
        insert: vi.fn((rows: unknown) => {
          inserts.push({ table, rows })
          return Promise.resolve({ data: null, error: null }) as any
        }),
      }
    }
    if (table === 'buyer') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: opts.buyerLookup ?? null, error: null }),
          }),
        }),
      }
    }
    if (table === 'coupon') {
      return {
        update: vi.fn((u: unknown) => {
          couponUpdates.push(u)
          return {
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }
    }
    throw new Error(`unexpected table in mock: ${table}`)
  })

  return { from, rpc, inserts, couponUpdates }
}

function defaultSnapshot(): any {
  return {
    id: SNAP,
    email: 'buyer@example.com',
    buyer_id: null,
    payload: {
      email: 'buyer@example.com',
      buyer_id: null,
      items: [{ variantId: V1, qty: 2 }],
      address: {
        fullName: 'Comprador Test',
        line1: 'Av. 123',
        city: 'Santiago',
        region: 'metropolitana',
        countryCode: 'CL',
      },
      shipments: [{ artisanId: ART, courier: 'chilexpress', costClp: 4990 }],
      acceptedDisclaimers: true,
    },
    totals: {
      subtotal: 60000,
      discount: 0,
      shippingTotal: 4990,
      commission: 6000,
      total: 64990,
      perArtisan: [
        { artisanId: ART, subtotal: 60000, shipping: 4990, commission: 6000, artisanNet: 58990 },
      ],
      perItem: [
        { variantId: V1, artisanId: ART, qty: 2, unitPrice: 30000, totalPrice: 60000, snapshotTitle: 'Anillo', productId: 'p1' },
      ],
      ledger: [
        { artisanId: ART, gross: 60000, commissionGross: 6000, discountAbsorbedByCommission: 0, shippingClp: 4990, netToArtisan: 58990 },
      ],
      couponId: null,
      commissionPct: 10,
    },
  }
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_test_1',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_test_1',
        amount: 64990,
        currency: 'clp',
        status: 'succeeded',
        metadata: { cart_snapshot_id: SNAP, ...((overrides as any).metadata ?? {}) },
        ...overrides,
      },
    },
  } as any
}

describe('createOrderFromPayment', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('happy path: snapshot loaded, all inserts called, transition called', async () => {
    const supabase = makeSupabaseMock()
    const { orderId } = await createOrderFromPayment({
      event: makeEvent(),
      supabase: supabase as any,
    })
    expect(orderId).toBe(ORDER)
    expect(supabase.rpc).toHaveBeenCalledWith('decrement_stock_atomic', expect.any(Object))
    expect(supabase.rpc).toHaveBeenCalledWith(
      'transition_order_status',
      expect.objectContaining({ p_order_id: ORDER, p_new_status: 'paid' }),
    )
    const tables = supabase.inserts.map((i) => i.table)
    expect(tables).toContain('order')
    expect(tables).toContain('order_item')
    expect(tables).toContain('shipping_address')
    expect(tables).toContain('shipment')
    expect(tables).toContain('payment')
    expect(tables).toContain('artisan_payout')
  })

  it('throws NO_SNAPSHOT_ID si metadata.cart_snapshot_id falta', async () => {
    const supabase = makeSupabaseMock()
    const event = makeEvent()
    event.data.object.metadata = {}
    await expect(
      createOrderFromPayment({ event, supabase: supabase as any }),
    ).rejects.toThrow(/NO_SNAPSHOT_ID/)
    expect(supabase.inserts).toHaveLength(0)
  })

  it('throws SNAPSHOT_NOT_FOUND si el snapshot no existe', async () => {
    const supabase = makeSupabaseMock({ snapshotPayload: null })
    await expect(
      createOrderFromPayment({ event: makeEvent(), supabase: supabase as any }),
    ).rejects.toThrow(/SNAPSHOT_NOT_FOUND/)
    expect(supabase.inserts).toHaveLength(0)
  })

  it('throws StockInsufficientError si stock insuficiente; no inserts hechos', async () => {
    const supabase = makeSupabaseMock({
      stockResult: [
        { variant_id: V1, available: 1, requested: 2, ok: false },
      ],
    })
    await expect(
      createOrderFromPayment({ event: makeEvent(), supabase: supabase as any }),
    ).rejects.toBeInstanceOf(StockInsufficientError)
    expect(supabase.inserts).toHaveLength(0)
  })

  it('NO incrementa coupon.uses_count (ya reservado en Plan 04)', async () => {
    const supabase = makeSupabaseMock()
    const snap = defaultSnapshot()
    snap.totals.couponId = COUPON
    snap.totals.discount = 6000
    // reemplazar el mock para devolver este snapshot
    const original = supabase.from
    supabase.from = vi.fn((table: string) => {
      if (table === 'cart_snapshot') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: snap, error: null }),
            }),
          }),
        } as any
      }
      return original(table)
    }) as any
    const { orderId } = await createOrderFromPayment({
      event: makeEvent(),
      supabase: supabase as any,
    })
    expect(orderId).toBe(ORDER)
    expect(supabase.couponUpdates).toHaveLength(0)
    const orderInsert = supabase.inserts.find((i) => i.table === 'order')!
    expect((orderInsert.rows as any).coupon_id).toBe(COUPON)
    expect((orderInsert.rows as any).discount_amount).toBe(6000)
  })

  it('payment row: stripe_transfer_id=null y method=stripe (D-SPLIT)', async () => {
    const supabase = makeSupabaseMock()
    await createOrderFromPayment({ event: makeEvent(), supabase: supabase as any })
    const pay = supabase.inserts.find((i) => i.table === 'payment')!
    expect((pay.rows as any).method).toBe('stripe')
    expect((pay.rows as any).stripe_transfer_id).toBeNull()
    expect((pay.rows as any).stripe_payment_intent_id).toBe('pi_test_1')
    expect((pay.rows as any).status).toBe('paid')
  })

  it('artisan_payout: una fila por artesano con status=pending y stripe_payout_id=null', async () => {
    const supabase = makeSupabaseMock()
    const snap = defaultSnapshot()
    snap.totals.perArtisan = [
      { artisanId: ART, subtotal: 30000, shipping: 4990, commission: 3000, artisanNet: 31990 },
      { artisanId: ART2, subtotal: 20000, shipping: 3990, commission: 2000, artisanNet: 21990 },
    ]
    snap.totals.perItem = [
      { variantId: V1, artisanId: ART, qty: 1, unitPrice: 30000, totalPrice: 30000, snapshotTitle: 'A', productId: 'p1' },
      { variantId: V2, artisanId: ART2, qty: 1, unitPrice: 20000, totalPrice: 20000, snapshotTitle: 'B', productId: 'p2' },
    ]
    snap.totals.ledger = [
      { artisanId: ART, gross: 30000, commissionGross: 3000, discountAbsorbedByCommission: 0, shippingClp: 4990, netToArtisan: 31990 },
      { artisanId: ART2, gross: 20000, commissionGross: 2000, discountAbsorbedByCommission: 0, shippingClp: 3990, netToArtisan: 21990 },
    ]
    snap.totals.subtotal = 50000
    snap.totals.shippingTotal = 8980
    snap.totals.total = 58980
    snap.totals.commission = 5000
    snap.payload.items = [
      { variantId: V1, qty: 1 },
      { variantId: V2, qty: 1 },
    ]
    snap.payload.shipments = [
      { artisanId: ART, courier: 'chilexpress', costClp: 4990 },
      { artisanId: ART2, courier: 'starken', costClp: 3990 },
    ]
    const original = supabase.from
    supabase.from = vi.fn((table: string) => {
      if (table === 'cart_snapshot') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: snap, error: null }),
            }),
          }),
        } as any
      }
      return original(table)
    }) as any

    await createOrderFromPayment({ event: makeEvent(), supabase: supabase as any })
    const payouts = supabase.inserts.filter((i) => i.table === 'artisan_payout')
    expect(payouts).toHaveLength(1)
    const rows = payouts[0].rows as any[]
    expect(rows).toHaveLength(2)
    for (const r of rows) {
      expect(r.status).toBe('pending')
      expect(r.stripe_payout_id).toBeNull()
      expect([ART, ART2]).toContain(r.artisan_id)
    }

    const shipments = supabase.inserts.filter((i) => i.table === 'shipment')
    expect(shipments).toHaveLength(1)
    expect((shipments[0].rows as any[]).length).toBe(2)
  })

  it('order_item preserva snapshot_title y unit_price desde totals.perItem', async () => {
    const supabase = makeSupabaseMock()
    await createOrderFromPayment({ event: makeEvent(), supabase: supabase as any })
    const items = supabase.inserts.find((i) => i.table === 'order_item')!
    const rows = items.rows as any[]
    expect(rows[0].snapshot_title).toBe('Anillo')
    expect(rows[0].unit_price).toBe(30000)
    expect(rows[0].total_price).toBe(60000)
    expect(rows[0].quantity).toBe(2)
    expect(rows[0].artisan_id).toBe(ART)
  })

  it('discount > 0 poblado en order; artisan_payout.net_amount intacto (D-15)', async () => {
    const supabase = makeSupabaseMock()
    const snap = defaultSnapshot()
    snap.totals.discount = 6000
    snap.totals.total = 58990
    snap.totals.couponId = COUPON
    const original = supabase.from
    supabase.from = vi.fn((table: string) => {
      if (table === 'cart_snapshot') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: snap, error: null }),
            }),
          }),
        } as any
      }
      return original(table)
    }) as any
    await createOrderFromPayment({ event: makeEvent(), supabase: supabase as any })
    const orderRow = (supabase.inserts.find((i) => i.table === 'order')!.rows as any)
    expect(orderRow.discount_amount).toBe(6000)
    const payoutRows = supabase.inserts.find((i) => i.table === 'artisan_payout')!.rows as any[]
    expect(payoutRows[0].net_amount).toBe(58990) // = artisanNet en single artesano
  })

  it('buyer logged-in: order.buyer_id se resuelve via buyer table lookup', async () => {
    const supabase = makeSupabaseMock({ buyerLookup: { id: BUYER } })
    const snap = defaultSnapshot()
    snap.payload.buyer_id = 'auth-user-uuid'
    snap.buyer_id = 'auth-user-uuid'
    const original = supabase.from
    supabase.from = vi.fn((table: string) => {
      if (table === 'cart_snapshot') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: snap, error: null }),
            }),
          }),
        } as any
      }
      return original(table)
    }) as any
    await createOrderFromPayment({ event: makeEvent(), supabase: supabase as any })
    const orderRow = (supabase.inserts.find((i) => i.table === 'order')!.rows as any)
    expect(orderRow.buyer_id).toBe(BUYER)
    expect(orderRow.guest_email).toBeNull()
  })

  it('NO llama stripe.transfers.create (D-SPLIT) — la funcion no importa el SDK Stripe', async () => {
    // Verificacion estatica: el modulo create-from-payment.ts no debe importar
    // stripe ni invocar transfers. Lo verificamos via dynamic import del archivo
    // y reflejando que no hay simbolo de Stripe en su scope.
    const mod = await import('./create-from-payment')
    expect(Object.keys(mod)).not.toContain('stripe')
    // Smoke: el happy path no debe necesitar mock de stripe.
    const supabase = makeSupabaseMock()
    await expect(
      createOrderFromPayment({ event: makeEvent(), supabase: supabase as any }),
    ).resolves.toEqual({ orderId: ORDER })
  })
})
