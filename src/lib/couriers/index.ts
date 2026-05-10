// Stub — implementado en GREEN
import type { CourierAdapter, QuoteResult } from './types'
export const TIMEOUT_MS = 5000
export async function quote(
  _courier: 'chilexpress' | 'starken',
  _params: unknown,
  _deps?: { quoteChilexpress: CourierAdapter; quoteStarken: CourierAdapter },
): Promise<QuoteResult> {
  throw new Error('NOT_IMPLEMENTED')
}
export async function quoteForCart(
  _input: unknown,
  _deps?: { quoteChilexpress: CourierAdapter; quoteStarken: CourierAdapter },
): Promise<{ quotes: Array<{ artisanId: string; quote: QuoteResult }> }> {
  throw new Error('NOT_IMPLEMENTED')
}
