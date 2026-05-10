/**
 * Phase 3 Plan 06 — sendOrderConfirmedEmail tests.
 *
 * Mock Resend + Supabase service-role.
 * Casos:
 *  1. Happy path buyer logged: order.buyer_id presente -> resend.emails.send 1 vez, sin token.
 *  2. Guest path: order.buyer_id null + guest_email -> token incluido en props del template.
 *  3. Order not found: NO send.
 *  4. Failure non-blocking: resend retorna {error}, no throw.
 *  5. Wire en webhook: spy que dispara cuando handler procesa payment_intent.succeeded.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Env preflight
process.env.GUEST_TOKEN_SECRET = 'test-secret-for-send-order-confirmed-aaaaaaaaaa'
process.env.RESEND_API_KEY = 're_test_key_xxx'
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE = 'service-role-mock'
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_xxx'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock_xxx'

const { resendSendMock, supabaseAdminClient, templateSpy } = vi.hoisted(() => {
  const resendSendMock = vi.fn()
  // Tabla -> filas a retornar por single()
  const tableData: Record<string, unknown> = {}

  const supabaseAdminClient: any = {
    __setOrder(row: unknown) {
      tableData['order'] = row
    },
    from(table: string) {
      const builder: any = {
        _filters: {} as Record<string, unknown>,
        select() {
          return builder
        },
        eq(_col: string, _val: string) {
          return builder
        },
        single() {
          if (table === 'order') {
            const row = tableData['order']
            if (!row) return Promise.resolve({ data: null, error: { code: 'PGRST116' } })
            return Promise.resolve({ data: row, error: null })
          }
          if (table === 'user') {
            return Promise.resolve({ data: { email: 'buyer@example.com' }, error: null })
          }
          if (table === 'buyer') {
            return Promise.resolve({ data: { user_id: 'user-123' }, error: null })
          }
          return Promise.resolve({ data: null, error: null })
        },
      }
      return builder
    },
    auth: {
      admin: {
        getUserById: vi.fn(async (_id: string) => ({
          data: { user: { id: _id, email: 'buyer@example.com' } },
          error: null,
        })),
      },
    },
  }

  // Spy del template factory: captura props
  const templateSpy = vi.fn((props: unknown) => ({ __template: 'order-confirmed', props }))

  return { resendSendMock, supabaseAdminClient, templateSpy }
})

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: resendSendMock }
  },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createServiceRoleClient: () => supabaseAdminClient,
}))

vi.mock('@/lib/resend/templates/order-confirmed', () => ({
  OrderConfirmedEmail: templateSpy,
}))

import { sendOrderConfirmedEmail } from './send-order-confirmed'

const BASE_ORDER = {
  id: 'order-uuid-123',
  buyer_id: 'buyer-row-id',
  guest_email: null,
  total: 50000,
  subtotal: 45000,
  shipping_cost: 5000,
  discount_amount: 0,
  commission_amount: 6000,
  created_at: '2025-01-15T10:00:00Z',
  status: 'paid',
  order_item: [
    {
      snapshot_title: 'Anillo de plata',
      unit_price: 45000,
      quantity: 1,
      artisan_id: 'artisan-1',
    },
  ],
  shipping_address: {
    full_name: 'Juan Pérez',
    line1: 'Calle Falsa 123',
    city: 'Santiago',
    region: 'RM',
  },
  shipment: [
    {
      courier: 'chilexpress',
      estimated_delivery: '2025-01-22',
      artisan_id: 'artisan-1',
    },
  ],
}

describe('sendOrderConfirmedEmail', () => {
  beforeEach(() => {
    resendSendMock.mockReset()
    resendSendMock.mockResolvedValue({ data: { id: 'email-id-1' }, error: null })
    templateSpy.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('happy path buyer logged: send invocado una vez sin token', async () => {
    supabaseAdminClient.__setOrder({ ...BASE_ORDER })
    await sendOrderConfirmedEmail('order-uuid-123')

    expect(resendSendMock).toHaveBeenCalledTimes(1)
    const args = resendSendMock.mock.calls[0][0]
    expect(args.to).toBe('buyer@example.com')
    expect(args.subject).toMatch(/Confirmación.*order-uu/i)
    expect(args.react).toBeTruthy()

    expect(templateSpy).toHaveBeenCalledTimes(1)
    const props = templateSpy.mock.calls[0][0] as { magicLinkToken?: string }
    expect(props.magicLinkToken).toBeUndefined()
  })

  it('guest path: token incluido + envio a guest_email', async () => {
    supabaseAdminClient.__setOrder({
      ...BASE_ORDER,
      buyer_id: null,
      guest_email: 'guest@example.com',
    })
    await sendOrderConfirmedEmail('order-uuid-123')

    expect(resendSendMock).toHaveBeenCalledTimes(1)
    const args = resendSendMock.mock.calls[0][0]
    expect(args.to).toBe('guest@example.com')

    const props = templateSpy.mock.calls[0][0] as {
      magicLinkToken?: string
      magicLinkUrl?: string
    }
    expect(props.magicLinkToken).toBeTruthy()
    expect(typeof props.magicLinkToken).toBe('string')
    expect(props.magicLinkToken!.length).toBeGreaterThan(20)
  })

  it('order no encontrada: NO se llama Resend', async () => {
    supabaseAdminClient.__setOrder(null)
    await sendOrderConfirmedEmail('does-not-exist')
    expect(resendSendMock).not.toHaveBeenCalled()
  })

  it('Resend retorna error: NO throw, console.error invocado', async () => {
    supabaseAdminClient.__setOrder({ ...BASE_ORDER })
    resendSendMock.mockResolvedValueOnce({
      data: null,
      error: { name: 'send_failed', message: 'rate limited' },
    })
    await expect(sendOrderConfirmedEmail('order-uuid-123')).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })

  it('order sin recipient (no buyer_id, no guest_email): NO send', async () => {
    supabaseAdminClient.__setOrder({
      ...BASE_ORDER,
      buyer_id: null,
      guest_email: null,
    })
    await sendOrderConfirmedEmail('order-uuid-123')
    expect(resendSendMock).not.toHaveBeenCalled()
  })

  it('Resend throw: NO propaga, console.error invocado (best-effort)', async () => {
    supabaseAdminClient.__setOrder({ ...BASE_ORDER })
    resendSendMock.mockRejectedValueOnce(new Error('network down'))
    await expect(sendOrderConfirmedEmail('order-uuid-123')).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })
})
