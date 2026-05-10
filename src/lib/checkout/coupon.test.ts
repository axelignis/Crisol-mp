import { describe, it, expect, vi } from 'vitest'
import { validateCoupon, reserveCoupon } from './coupon'

type RowData = {
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

function mockSupabaseSelect(row: RowData | null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
        }),
      }),
    }),
  }
}

function mockSupabaseRpc(rows: Array<{ id: string; discount_type: string; discount_value: number }>) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: rows, error: null }),
  }
}

describe('validateCoupon (preview)', () => {
  it('not_found → invalid', async () => {
    const sb = mockSupabaseSelect(null)
    const r = await validateCoupon('NOPE', 50000, sb as never)
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('not_found')
  })

  it('expired → invalid', async () => {
    const sb = mockSupabaseSelect({
      id: 'c1',
      code: 'EXP',
      discount_type: 'percentage',
      discount_value: 10,
      min_order: null,
      uses_limit: null,
      uses_count: 0,
      expires_at: '2020-01-01T00:00:00Z',
      is_active: true,
    })
    const r = await validateCoupon('EXP', 50000, sb as never)
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('expired')
  })

  it('uses_limit reached → invalid', async () => {
    const sb = mockSupabaseSelect({
      id: 'c1',
      code: 'X',
      discount_type: 'percentage',
      discount_value: 10,
      min_order: null,
      uses_limit: 5,
      uses_count: 5,
      expires_at: null,
      is_active: true,
    })
    const r = await validateCoupon('X', 50000, sb as never)
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('limit_reached')
  })

  it('min_order > subtotal → invalid', async () => {
    const sb = mockSupabaseSelect({
      id: 'c1',
      code: 'BIENVENIDA',
      discount_type: 'fixed',
      discount_value: 5000,
      min_order: 30000,
      uses_limit: null,
      uses_count: 0,
      expires_at: null,
      is_active: true,
    })
    const r = await validateCoupon('BIENVENIDA', 20000, sb as never)
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('min_order')
  })

  it('percentage 10% sobre subtotal 100000 → discount=10000', async () => {
    const sb = mockSupabaseSelect({
      id: 'c1',
      code: 'CRISOL10',
      discount_type: 'percentage',
      discount_value: 10,
      min_order: null,
      uses_limit: null,
      uses_count: 0,
      expires_at: null,
      is_active: true,
    })
    const r = await validateCoupon('CRISOL10', 100000, sb as never)
    expect(r.valid).toBe(true)
    if (r.valid) {
      expect(r.discount).toBe(10000)
      expect(r.couponId).toBe('c1')
    }
  })

  it('fixed 5000 cap si subtotal=3000 → discount=3000', async () => {
    const sb = mockSupabaseSelect({
      id: 'c1',
      code: 'CINCO',
      discount_type: 'fixed',
      discount_value: 5000,
      min_order: null,
      uses_limit: null,
      uses_count: 0,
      expires_at: null,
      is_active: true,
    })
    const r = await validateCoupon('CINCO', 3000, sb as never)
    expect(r.valid).toBe(true)
    if (r.valid) expect(r.discount).toBe(3000)
  })

  it('inactive → invalid', async () => {
    const sb = mockSupabaseSelect({
      id: 'c1',
      code: 'OFF',
      discount_type: 'percentage',
      discount_value: 10,
      min_order: null,
      uses_limit: null,
      uses_count: 0,
      expires_at: null,
      is_active: false,
    })
    const r = await validateCoupon('OFF', 50000, sb as never)
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('inactive')
  })
})

describe('reserveCoupon (atomic UPDATE)', () => {
  it('happy path → uses_count incrementado, retorna couponId+discount', async () => {
    const sb = mockSupabaseRpc([{ id: 'c1', discount_type: 'percentage', discount_value: 10 }])
    const r = await reserveCoupon('CRISOL10', 100000, sb as never)
    expect(r.valid).toBe(true)
    if (r.valid) {
      expect(r.couponId).toBe('c1')
      expect(r.discount).toBe(10000)
    }
    expect(sb.rpc).toHaveBeenCalledWith('reserve_coupon', expect.objectContaining({ p_code: 'CRISOL10', p_subtotal: 100000 }))
  })

  it('uses_limit reached / race → 0 rows → invalid race_or_limit_reached', async () => {
    const sb = mockSupabaseRpc([])
    const r = await reserveCoupon('CRISOL10', 100000, sb as never)
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('race_or_limit_reached')
  })

  it('cupón fixed: discount cap al subtotal', async () => {
    const sb = mockSupabaseRpc([{ id: 'c2', discount_type: 'fixed', discount_value: 99999 }])
    const r = await reserveCoupon('BIG', 5000, sb as never)
    expect(r.valid).toBe(true)
    if (r.valid) expect(r.discount).toBe(5000)
  })
})
