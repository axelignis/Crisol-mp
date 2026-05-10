import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createOrderFromPayment,
  StockInsufficientError,
  SnapshotNotFoundError,
  CouponLimitReachedError,
} from './create-from-payment'

const SNAP = '55555555-5555-5555-5555-555555555555'
const ORDER = '66666666-6666-6666-6666-666666666666'
const V1 = '33333333-3333-3333-3333-333333333333'
const V2 = '44444444-4444-4444-4444-444444444444'

/**
 * Mock minimo del SupabaseClient: la nueva implementacion CR-01 solo
 * llama supabase.rpc('create_order_from_snapshot', ...). Toda la
 * lógica de inserts, locks, decrement vive en SQL (migracion 023);
 * la verificacion transaccional se hace via integration tests E2E +
 * `supabase db reset` que ejercita la RPC contra Postgres real.
 */
function makeSupabaseRpcMock(
  result:
    | { data: Array<{ order_id: string | null; error_code: string | null }>; error: null }
    | { data: null; error: { message: string } }
) {
  return {
    rpc: vi.fn(async (fn: string) => {
      if (fn !== 'create_order_from_snapshot') {
        throw new Error(`unexpected rpc: ${fn}`)
      }
      return result
    }),
  }
}

function makeEvent(metadata: Record<string, string> = { cart_snapshot_id: SNAP }) {
  return {
    id: 'evt_test_1',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_test_1',
        amount: 64990,
        currency: 'clp',
        status: 'succeeded',
        metadata,
      },
    },
  } as never
}

describe('createOrderFromPayment (wrapper de RPC create_order_from_snapshot, CR-01)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('happy path: invoca RPC con snapshotId/piId y retorna orderId', async () => {
    const supabase = makeSupabaseRpcMock({
      data: [{ order_id: ORDER, error_code: null }],
      error: null,
    })
    const { orderId } = await createOrderFromPayment({
      event: makeEvent(),
      supabase: supabase as never,
    })
    expect(orderId).toBe(ORDER)
    expect(supabase.rpc).toHaveBeenCalledWith(
      'create_order_from_snapshot',
      expect.objectContaining({
        p_snapshot_id: SNAP,
        p_pi_id: 'pi_test_1',
      })
    )
  })

  it('throws NO_SNAPSHOT_ID si metadata.cart_snapshot_id falta (no llama RPC)', async () => {
    const supabase = makeSupabaseRpcMock({
      data: [{ order_id: ORDER, error_code: null }],
      error: null,
    })
    await expect(
      createOrderFromPayment({ event: makeEvent({}), supabase: supabase as never }),
    ).rejects.toThrow(/NO_SNAPSHOT_ID/)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('throws SnapshotNotFoundError si la RPC retorna error_code=SNAPSHOT_NOT_FOUND', async () => {
    const supabase = makeSupabaseRpcMock({
      data: [{ order_id: null, error_code: 'SNAPSHOT_NOT_FOUND' }],
      error: null,
    })
    await expect(
      createOrderFromPayment({ event: makeEvent(), supabase: supabase as never }),
    ).rejects.toBeInstanceOf(SnapshotNotFoundError)
  })

  it('throws StockInsufficientError parseado desde error_code (un variant)', async () => {
    const supabase = makeSupabaseRpcMock({
      data: [
        {
          order_id: null,
          error_code: `STOCK_INSUFFICIENT:${V1}:1:2;`,
        },
      ],
      error: null,
    })
    await expect(
      createOrderFromPayment({ event: makeEvent(), supabase: supabase as never }),
    ).rejects.toMatchObject({
      name: 'StockInsufficientError',
      insufficient: [{ variantId: V1, available: 1, requested: 2 }],
    })
  })

  it('throws StockInsufficientError parseado desde error_code (multiples variants)', async () => {
    const supabase = makeSupabaseRpcMock({
      data: [
        {
          order_id: null,
          error_code: `STOCK_INSUFFICIENT:${V1}:0:1;${V2}:2:5;`,
        },
      ],
      error: null,
    })
    try {
      await createOrderFromPayment({ event: makeEvent(), supabase: supabase as never })
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(StockInsufficientError)
      const err = e as StockInsufficientError
      expect(err.insufficient).toHaveLength(2)
      expect(err.insufficient[0]).toEqual({ variantId: V1, available: 0, requested: 1 })
      expect(err.insufficient[1]).toEqual({ variantId: V2, available: 2, requested: 5 })
    }
  })

  it('throws CouponLimitReachedError si error_code=COUPON_LIMIT_REACHED', async () => {
    const supabase = makeSupabaseRpcMock({
      data: [{ order_id: null, error_code: 'COUPON_LIMIT_REACHED' }],
      error: null,
    })
    await expect(
      createOrderFromPayment({ event: makeEvent(), supabase: supabase as never }),
    ).rejects.toBeInstanceOf(CouponLimitReachedError)
  })

  it('throws CouponLimitReachedError si la RPC raise excepcion P0001 con ese mensaje', async () => {
    // Caso alternativo: la RPC RAISE EXCEPTION → Supabase devuelve error.message
    const supabase = makeSupabaseRpcMock({
      data: null,
      error: { message: 'COUPON_LIMIT_REACHED' },
    })
    await expect(
      createOrderFromPayment({ event: makeEvent(), supabase: supabase as never }),
    ).rejects.toBeInstanceOf(CouponLimitReachedError)
  })

  it('propaga error generico de la RPC con prefijo create_order_rpc_error', async () => {
    const supabase = makeSupabaseRpcMock({
      data: null,
      error: { message: 'connection lost' },
    })
    await expect(
      createOrderFromPayment({ event: makeEvent(), supabase: supabase as never }),
    ).rejects.toThrow(/create_order_rpc_error: connection lost/)
  })

  it('throws si la RPC retorna 0 filas inesperadamente', async () => {
    const supabase = makeSupabaseRpcMock({
      data: [],
      error: null,
    })
    await expect(
      createOrderFromPayment({ event: makeEvent(), supabase: supabase as never }),
    ).rejects.toThrow(/create_order_rpc_no_rows/)
  })

  it('NO importa el SDK Stripe (D-SPLIT verificacion estatica)', async () => {
    const mod = await import('./create-from-payment')
    expect(Object.keys(mod)).not.toContain('stripe')
  })
})
