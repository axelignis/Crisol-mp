// Stub RED.
export type LedgerEntry = {
  artisanId: string
  gross: number
  commissionGross: number
  discountAbsorbedByCommission: number
  shippingClp: number
  netToArtisan: number
}

export type LedgerInput = {
  perArtisan: Array<{ artisanId: string; subtotal: number; shipping: number; commission: number; artisanNet: number }>
  discount: number
  subtotal: number
  shippingTotal: number
}

export function buildPayoutLedger(_input: LedgerInput): LedgerEntry[] {
  throw new Error('not implemented')
}
