import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { quote, quoteForCart, TIMEOUT_MS } from './index'
import type { QuoteParams, QuoteResult, CourierAdapter } from './types'

const baseParams: QuoteParams = {
  origin: { region: 'metropolitana', comuna: 'santiago' },
  destination: {
    region: 'valparaiso',
    comuna: 'vina-del-mar',
    countryCode: 'CL',
  },
  package: { weightKg: 1, lengthCm: 20, widthCm: 15, heightCm: 10 },
}

const happyChilex: QuoteResult = {
  source: 'chilexpress',
  costClp: 5500,
  etaDays: 3,
  serviceCode: 'NORMAL',
}

const happyStarken: QuoteResult = {
  source: 'starken',
  costClp: 5200,
  etaDays: 4,
  serviceCode: 'NORMAL',
}

describe('quote()', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('happy path chilexpress', async () => {
    const adapter: CourierAdapter = vi.fn().mockResolvedValue(happyChilex)
    const result = await quote('chilexpress', baseParams, {
      quoteChilexpress: adapter,
      quoteStarken: vi.fn(),
    })
    expect(result.source).toBe('chilexpress')
    expect(result.costClp).toBe(5500)
    expect(adapter).toHaveBeenCalledWith(baseParams)
  })

  it('happy path starken', async () => {
    const adapter: CourierAdapter = vi.fn().mockResolvedValue(happyStarken)
    const result = await quote('starken', baseParams, {
      quoteChilexpress: vi.fn(),
      quoteStarken: adapter,
    })
    expect(result.source).toBe('starken')
    expect(result.costClp).toBe(5200)
  })

  it('chilexpress falla → flat_rate', async () => {
    const adapter: CourierAdapter = vi
      .fn()
      .mockRejectedValue(new Error('500 server error'))
    const result = await quote('chilexpress', baseParams, {
      quoteChilexpress: adapter,
      quoteStarken: vi.fn(),
    })
    expect(result.source).toBe('flat_rate')
    expect(result.costClp).toBe(5990) // valparaiso
    expect(result.warning).toBe('chilexpress_failed')
  })

  it('timeout >5s → flat_rate', async () => {
    vi.useFakeTimers()
    const adapter: CourierAdapter = () =>
      new Promise<QuoteResult>((resolve) => {
        setTimeout(() => resolve(happyChilex), TIMEOUT_MS + 1000)
      })
    const promise = quote('chilexpress', baseParams, {
      quoteChilexpress: adapter,
      quoteStarken: vi.fn(),
    })
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 100)
    const result = await promise
    expect(result.source).toBe('flat_rate')
    expect(result.warning).toBe('chilexpress_failed')
    vi.useRealTimers()
  })

  it('country !== CL → throws', async () => {
    await expect(
      quote(
        'chilexpress',
        {
          ...baseParams,
          destination: { ...baseParams.destination, countryCode: 'US' },
        },
        { quoteChilexpress: vi.fn(), quoteStarken: vi.fn() },
      ),
    ).rejects.toThrow(/CL_ONLY|Solo Chile/)
  })

  it('región desconocida → flat-rate default', async () => {
    const adapter: CourierAdapter = vi
      .fn()
      .mockRejectedValue(new Error('boom'))
    const result = await quote(
      'chilexpress',
      {
        ...baseParams,
        destination: {
          ...baseParams.destination,
          region: 'region-inexistente-xyz',
        },
      },
      { quoteChilexpress: adapter, quoteStarken: vi.fn() },
    )
    expect(result.source).toBe('flat_rate')
    expect(result.costClp).toBe(7990) // default
  })

  it('costClp siempre integer', async () => {
    const adapter: CourierAdapter = vi
      .fn()
      .mockResolvedValue({ ...happyChilex, costClp: 5500 })
    const result = await quote('chilexpress', baseParams, {
      quoteChilexpress: adapter,
      quoteStarken: vi.fn(),
    })
    expect(Number.isInteger(result.costClp)).toBe(true)
  })
})

describe('quoteForCart()', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('multi-artisan parallel: 2 happy + 1 falla → 2 reales + 1 flat_rate, orden preservado', async () => {
    const okAdapter: CourierAdapter = vi
      .fn()
      .mockResolvedValueOnce(happyChilex)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ...happyChilex, costClp: 6000 })

    const result = await quoteForCart(
      {
        destination: baseParams.destination,
        groups: [
          { artisanId: 'a1', origin: baseParams.origin, package: baseParams.package },
          { artisanId: 'a2', origin: baseParams.origin, package: baseParams.package },
          { artisanId: 'a3', origin: baseParams.origin, package: baseParams.package },
        ],
      },
      { quoteChilexpress: okAdapter, quoteStarken: vi.fn() },
    )

    expect(result.quotes).toHaveLength(3)
    expect(result.quotes[0].artisanId).toBe('a1')
    expect(result.quotes[1].artisanId).toBe('a2')
    expect(result.quotes[2].artisanId).toBe('a3')
    expect(result.quotes[0].quote.source).toBe('chilexpress')
    expect(result.quotes[1].quote.source).toBe('flat_rate')
    expect(result.quotes[2].quote.source).toBe('chilexpress')
    expect(result.quotes[2].quote.costClp).toBe(6000)
  })

  it('countryCode !== CL → throws', async () => {
    await expect(
      quoteForCart(
        {
          destination: { ...baseParams.destination, countryCode: 'AR' },
          groups: [
            { artisanId: 'a1', origin: baseParams.origin, package: baseParams.package },
          ],
        },
        { quoteChilexpress: vi.fn(), quoteStarken: vi.fn() },
      ),
    ).rejects.toThrow(/CL_ONLY|Solo Chile/)
  })
})
