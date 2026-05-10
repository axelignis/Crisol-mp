import type {
  CartArtisanGroup,
  CourierAdapter,
  CourierName,
  QuoteForCartInput,
  QuoteForCartResult,
  QuoteParams,
  QuoteResult,
} from './types'
import { flatRateFallback } from './flat-rate'
import { quoteChilexpress as defaultChilex } from './chilexpress'
import { quoteStarken as defaultStarken } from './starken'

export const TIMEOUT_MS = 5000

type Deps = {
  quoteChilexpress: CourierAdapter
  quoteStarken: CourierAdapter
}

const defaultDeps: Deps = {
  quoteChilexpress: defaultChilex,
  quoteStarken: defaultStarken,
}

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('TIMEOUT')), ms)
  })
}

function ensureCL(params: QuoteParams): void {
  if (params.destination.countryCode !== 'CL') {
    throw new Error('CL_ONLY: Solo envíos a Chile en esta versión')
  }
}

function toIntegerCost(result: QuoteResult): QuoteResult {
  return { ...result, costClp: Math.round(result.costClp) }
}

export async function quote(
  courier: CourierName,
  params: QuoteParams,
  deps: Deps = defaultDeps,
): Promise<QuoteResult> {
  ensureCL(params)
  const adapter =
    courier === 'chilexpress' ? deps.quoteChilexpress : deps.quoteStarken
  try {
    const result = await Promise.race<QuoteResult>([
      adapter(params),
      timeoutAfter(TIMEOUT_MS),
    ])
    return toIntegerCost(result)
  } catch (err) {
    console.error('[couriers]', courier, (err as Error).message)
    const fallback = flatRateFallback(params)
    return toIntegerCost({ ...fallback, warning: `${courier}_failed` })
  }
}

export async function quoteForCart(
  input: QuoteForCartInput,
  deps: Deps = defaultDeps,
): Promise<QuoteForCartResult> {
  if (input.destination.countryCode !== 'CL') {
    throw new Error('CL_ONLY: Solo envíos a Chile en esta versión')
  }
  const courier: CourierName = input.preferredCourier ?? 'chilexpress'
  const quotes = await Promise.all(
    input.groups.map(async (g: CartArtisanGroup) => ({
      artisanId: g.artisanId,
      quote: await quote(
        courier,
        {
          origin: g.origin,
          destination: input.destination,
          package: g.package,
        },
        deps,
      ),
    })),
  )
  return { quotes }
}
