import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// IMPORTANTE: declarar STRIPE_SECRET_KEY antes de cualquier import del módulo stripe
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_xxx'

// Mocks (hoisted para evitar TDZ con vi.mock factory)
const { stripeCreateMock, supabaseMock } = vi.hoisted(() => ({
  stripeCreateMock: vi.fn(),
  supabaseMock: {} as any,
}))

vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    paymentIntents: { create: stripeCreateMock },
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabaseMock),
}))

import { POST } from './route'

const ART = '11111111-1111-1111-1111-111111111111'
const ART2 = '22222222-2222-2222-2222-222222222222'
const V1 = '33333333-3333-3333-3333-333333333333'
const V2 = '44444444-4444-4444-4444-444444444444'

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/checkout/payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const validBody = {
  email: 'buyer@example.com',
  buyer_id: null,
  items: [{ variantId: V1, qty: 2 }],
  address: {
    fullName: 'Comprador Test',
    line1: 'Av. Siempre Viva 123',
    city: 'Santiago',
    region: 'metropolitana',
    countryCode: 'CL' as const,
  },
  shipments: [{ artisanId: ART, courier: 'chilexpress' as const, costClp: 4990 }],
  acceptedDisclaimers: true as const,
}

function setupHappySupabase() {
  // product_variant query
  const variantSelect = vi.fn().mockReturnValue({
    in: vi.fn().mockResolvedValue({
      data: [
        {
          id: V1,
          product_id: 'p1',
          price_modifier: 0,
          stock: 10,
          product: { id: 'p1', artisan_id: ART, base_price: 30000, status: 'published', title: 'Anillo', slug: 'anillo' },
        },
      ],
      error: null,
    }),
  })
  // commission_config query
  const commissionMaybe = vi.fn().mockResolvedValue({ data: { commission_pct: 10 }, error: null })
  const commissionLimit = vi.fn().mockReturnValue({ maybeSingle: commissionMaybe })
  const commissionOrder = vi.fn().mockReturnValue({ limit: commissionLimit })
  const commissionLte = vi.fn().mockReturnValue({ order: commissionOrder })
  const commissionSelect = vi.fn().mockReturnValue({ lte: commissionLte })
  // cart_snapshot insert
  const snapshotSingle = vi.fn().mockResolvedValue({ data: { id: 'snap-uuid-1' }, error: null })
  const snapshotSelect = vi.fn().mockReturnValue({ single: snapshotSingle })
  const snapshotInsert = vi.fn().mockReturnValue({ select: snapshotSelect })

  supabaseMock.from = vi.fn((table: string) => {
    if (table === 'product_variant') return { select: variantSelect }
    if (table === 'commission_config') return { select: commissionSelect }
    if (table === 'cart_snapshot') return { insert: snapshotInsert }
    if (table === 'coupon') {
      // Para tests de cupón no usado en happy path; default no-op
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }
    }
    throw new Error(`unexpected table: ${table}`)
  })
  supabaseMock.rpc = vi.fn().mockResolvedValue({ data: [], error: null })
  supabaseMock.auth = { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) }
}

describe('POST /api/checkout/payment-intent', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stripeCreateMock.mockReset()
    stripeCreateMock.mockResolvedValue({ client_secret: 'pi_secret_xxx', id: 'pi_xxx' })
    setupHappySupabase()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('happy path: 200 con clientSecret + totals + idempotencyKey', async () => {
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.clientSecret).toBe('pi_secret_xxx')
    expect(json.snapshotId).toBe('snap-uuid-1')
    expect(json.totals.subtotal).toBe(60000)
    expect(json.totals.total).toBe(64990)
    expect(json.totals).not.toHaveProperty('commission') // T-03-12
    expect(stripeCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 64990,
        currency: 'clp',
        metadata: expect.objectContaining({ cart_snapshot_id: 'snap-uuid-1' }),
      }),
      expect.objectContaining({ idempotencyKey: 'pi:snap-uuid-1' })
    )
  })

  it('400 si countryCode != CL (Zod literal)', async () => {
    const body = { ...validBody, address: { ...validBody.address, countryCode: 'US' } }
    const res = await POST(makeReq(body))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('invalid_input')
  })

  it('400 si acceptedDisclaimers != true', async () => {
    const body = { ...validBody, acceptedDisclaimers: false }
    const res = await POST(makeReq(body))
    expect(res.status).toBe(400)
  })

  it('409 stock_insufficient si stock < qty', async () => {
    // Override variant stock = 1
    const variantSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          {
            id: V1, product_id: 'p1', price_modifier: 0, stock: 1,
            product: { id: 'p1', artisan_id: ART, base_price: 30000, status: 'published', title: 'X', slug: 's' },
          },
        ],
        error: null,
      }),
    })
    supabaseMock.from = vi.fn((table: string) => {
      if (table === 'product_variant') return { select: variantSelect }
      throw new Error(`unexpected table: ${table}`)
    })
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBe('stock_insufficient')
    expect(json.insufficient).toHaveLength(1)
    expect(stripeCreateMock).not.toHaveBeenCalled()
  })

  it('400 si shipments no cubren todos los artesanos', async () => {
    // 2 artesanos pero 1 solo shipment
    const variantSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          { id: V1, product_id: 'p1', price_modifier: 0, stock: 10, product: { id: 'p1', artisan_id: ART, base_price: 10000, status: 'published', title: 'X', slug: 'x' } },
          { id: V2, product_id: 'p2', price_modifier: 0, stock: 10, product: { id: 'p2', artisan_id: ART2, base_price: 5000, status: 'published', title: 'Y', slug: 'y' } },
        ],
        error: null,
      }),
    })
    const commissionMaybe = vi.fn().mockResolvedValue({ data: { commission_pct: 10 }, error: null })
    supabaseMock.from = vi.fn((table: string) => {
      if (table === 'product_variant') return { select: variantSelect }
      if (table === 'commission_config') return {
        select: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({ maybeSingle: commissionMaybe }),
            }),
          }),
        }),
      }
      throw new Error(`unexpected table: ${table}`)
    })
    const body = {
      ...validBody,
      items: [{ variantId: V1, qty: 1 }, { variantId: V2, qty: 1 }],
      shipments: [{ artisanId: ART, courier: 'chilexpress' as const, costClp: 4000 }],
    }
    const res = await POST(makeReq(body))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('shipment_missing')
  })

  it('409 coupon_invalid si cupón no existe (CR-02 read-only)', async () => {
    // Default mock devuelve coupon=null → validateCouponForCheckout retorna not_found
    const body = { ...validBody, couponCode: 'CRISOL10' }
    const res = await POST(makeReq(body))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBe('coupon_invalid')
    expect(json.reason).toBe('not_found')
  })

  it('happy path con cupón válido: discount aplicado a totales (CR-02 read-only, sin uses_count++)', async () => {
    // Override mock de la tabla coupon para devolver row válido
    const couponRow = {
      id: 'coupon-uuid',
      code: 'CRISOL10',
      discount_type: 'percentage',
      discount_value: 10,
      min_order: null,
      uses_limit: null,
      uses_count: 0,
      expires_at: null,
      is_active: true,
    }
    const originalFrom = supabaseMock.from
    supabaseMock.from = vi.fn((table: string) => {
      if (table === 'coupon') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: couponRow, error: null }),
            }),
          }),
        }
      }
      return originalFrom(table)
    })
    const body = { ...validBody, couponCode: 'CRISOL10' }
    const res = await POST(makeReq(body))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.totals.discount).toBe(6000)
    expect(json.totals.total).toBe(60000 - 6000 + 4990)
  })

  it('400 invalid_json si body no es JSON', async () => {
    const req = new Request('http://localhost/api/checkout/payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('invalid_json')
  })
})
