import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Env preflight ANTES de importar el handler
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_xxx'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock_xxx'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE = 'service-role-mock'

const {
  constructEventMock,
  createOrderFromPaymentMock,
  serviceRoleClient,
} = vi.hoisted(() => {
  const inserts: Array<{ table: string; rows: unknown }> = []
  const updates: Array<{ table: string; values: unknown; matched: unknown }> = []

  const mockClient: any = {
    __inserts: inserts,
    __updates: updates,
    __idempState: { nextInsertError: null as null | { code: string; message?: string } },
    from: (table: string) => {
      return {
        insert: (rows: unknown) => {
          if (table === 'webhook_event') {
            const err = mockClient.__idempState.nextInsertError
            if (err) {
              mockClient.__idempState.nextInsertError = null
              return Promise.resolve({ data: null, error: err })
            }
          }
          inserts.push({ table, rows })
          return Promise.resolve({ data: null, error: null })
        },
        update: (values: unknown) => {
          return {
            eq: (_col: string, _val: unknown) => {
              updates.push({ table, values, matched: _val })
              return Promise.resolve({ data: null, error: null })
            },
          }
        },
      }
    },
  }

  return {
    constructEventMock: vi.fn(),
    createOrderFromPaymentMock: vi.fn(),
    serviceRoleClient: mockClient,
  }
})

const { refundsCreateMock } = vi.hoisted(() => ({
  refundsCreateMock: vi.fn(),
}))

vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    webhooks: { constructEvent: constructEventMock },
    refunds: { create: refundsCreateMock },
  },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createServiceRoleClient: () => serviceRoleClient,
}))

vi.mock('@/lib/orders/create-from-payment', async () => {
  const actual: any = await vi.importActual('@/lib/orders/create-from-payment')
  return {
    ...actual,
    createOrderFromPayment: createOrderFromPaymentMock,
  }
})

import { POST } from './route'
import { StockInsufficientError } from '@/lib/orders/create-from-payment'

function makeReq(body: string, sig = 't=1,v1=mock'): Request {
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': sig, 'content-type': 'application/json' },
    body,
  })
}

function piSucceededEvent(id = 'evt_1', piId = 'pi_1') {
  return {
    id,
    type: 'payment_intent.succeeded',
    data: { object: { id: piId, metadata: { cart_snapshot_id: 'snap-1' } } },
  } as any
}

function piFailedEvent(id = 'evt_2') {
  return {
    id,
    type: 'payment_intent.payment_failed',
    data: { object: { id: 'pi_failed_1' } },
  } as any
}

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    constructEventMock.mockReset()
    createOrderFromPaymentMock.mockReset()
    refundsCreateMock.mockReset()
    refundsCreateMock.mockResolvedValue({ id: 're_mock_1' })
    serviceRoleClient.__inserts.length = 0
    serviceRoleClient.__updates.length = 0
    serviceRoleClient.__idempState.nextInsertError = null
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('400 si la firma es invalida', async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error('Invalid signature')
    })
    const res = await POST(makeReq('{"raw":true}'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('invalid_signature')
    // No inserts a webhook_event si firma falla
    expect(serviceRoleClient.__inserts).toHaveLength(0)
    expect(createOrderFromPaymentMock).not.toHaveBeenCalled()
  })

  it('happy path: firma valida + new event id -> 200, createOrderFromPayment llamado (WR-01: sin orderId leak)', async () => {
    constructEventMock.mockReturnValue(piSucceededEvent('evt_new'))
    createOrderFromPaymentMock.mockResolvedValue({ orderId: 'order-uuid' })
    const res = await POST(makeReq('{"raw":true}'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
    // WR-01: la respuesta a Stripe NO debe incluir orderId ni detalles internos
    expect(json.orderId).toBeUndefined()
    expect(createOrderFromPaymentMock).toHaveBeenCalledTimes(1)
    const idemInsert = serviceRoleClient.__inserts.find((i: { table: string }) => i.table === 'webhook_event')
    expect(idemInsert).toBeDefined()
    expect((idemInsert!.rows as any).id).toBe('evt_new')
  })

  it('duplicate event (PK 23505): 200 duplicate=true, NO se llama createOrderFromPayment', async () => {
    constructEventMock.mockReturnValue(piSucceededEvent('evt_dup'))
    serviceRoleClient.__idempState.nextInsertError = { code: '23505', message: 'duplicate key' }
    const res = await POST(makeReq('{"raw":true}'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
    expect(json.duplicate).toBe(true)
    expect(createOrderFromPaymentMock).not.toHaveBeenCalled()
  })

  it('payment_intent.payment_failed: 200, sin orden creada', async () => {
    constructEventMock.mockReturnValue(piFailedEvent())
    const res = await POST(makeReq('{"raw":true}'))
    expect(res.status).toBe(200)
    expect(createOrderFromPaymentMock).not.toHaveBeenCalled()
  })

  it('CR-03: stock insuficiente post-pago dispara refund automatico + flag error_message', async () => {
    constructEventMock.mockReturnValue(piSucceededEvent('evt_err', 'pi_refund_1'))
    createOrderFromPaymentMock.mockRejectedValue(
      new StockInsufficientError([{ variantId: 'v1', available: 0, requested: 2 }]),
    )
    const res = await POST(makeReq('{"raw":true}'))
    expect(res.status).toBe(200) // critico: NO 5xx (evita Stripe retry duplicado)
    const json = await res.json()
    expect(json.received).toBe(true)
    // WR-01: la respuesta NO debe filtrar detalles ni mensajes de error.
    expect(json.error).toBeUndefined()
    expect(json.details).toBeUndefined()

    // CR-03: refund debe haberse invocado con el PI id
    expect(refundsCreateMock).toHaveBeenCalledWith({
      payment_intent: 'pi_refund_1',
      reason: 'requested_by_customer',
    })
    // El webhook debe escribir error_message en webhook_event con el refund id
    const upd = serviceRoleClient.__updates.find((u: { table: string }) => u.table === 'webhook_event')
    expect(upd).toBeDefined()
    expect((upd!.values as any).error_message).toMatch(/insufficient/)
    expect((upd!.values as any).error_message).toMatch(/refunded_automatically:re_mock_1/)
  })

  it('CR-03: si el refund mismo falla, error_message anota refund_failed pero igual 200', async () => {
    constructEventMock.mockReturnValue(piSucceededEvent('evt_err2', 'pi_refund_fail'))
    createOrderFromPaymentMock.mockRejectedValue(
      new StockInsufficientError([{ variantId: 'v1', available: 0, requested: 2 }]),
    )
    refundsCreateMock.mockRejectedValueOnce(new Error('refund api down'))
    const res = await POST(makeReq('{"raw":true}'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
    const upd = serviceRoleClient.__updates.find((u: { table: string }) => u.table === 'webhook_event')
    expect(upd).toBeDefined()
    expect((upd!.values as any).error_message).toMatch(/refund_failed:refund api down/)
  })

  it('errores no-refundables (ej. NO_SNAPSHOT_ID) NO disparan refund', async () => {
    constructEventMock.mockReturnValue(piSucceededEvent('evt_err3', 'pi_no_refund'))
    createOrderFromPaymentMock.mockRejectedValue(new Error('NO_SNAPSHOT_ID'))
    const res = await POST(makeReq('{"raw":true}'))
    expect(res.status).toBe(200)
    expect(refundsCreateMock).not.toHaveBeenCalled()
    const upd = serviceRoleClient.__updates.find((u: { table: string }) => u.table === 'webhook_event')
    expect(upd).toBeDefined()
    expect((upd!.values as any).error_message).toBe('NO_SNAPSHOT_ID')
  })

  it('constructEvent recibe el raw body string (no parsed JSON)', async () => {
    const rawBody = '{"id":"evt_raw","type":"payment_intent.succeeded","data":{}}'
    constructEventMock.mockReturnValue(piSucceededEvent('evt_raw'))
    createOrderFromPaymentMock.mockResolvedValue({ orderId: 'order-x' })
    await POST(makeReq(rawBody))
    expect(constructEventMock).toHaveBeenCalledTimes(1)
    const [bodyArg, sigArg, secretArg] = constructEventMock.mock.calls[0]
    expect(typeof bodyArg).toBe('string')
    expect(bodyArg).toBe(rawBody)
    expect(sigArg).toBe('t=1,v1=mock')
    expect(secretArg).toBe('whsec_mock_xxx')
  })

  it('event type no manejado: 200 ignored', async () => {
    constructEventMock.mockReturnValue({ id: 'evt_x', type: 'customer.created', data: { object: {} } } as any)
    const res = await POST(makeReq('{"raw":true}'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ignored).toBe('customer.created')
  })

  it('signature header faltante -> 400', async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error('No stripe-signature header')
    })
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
