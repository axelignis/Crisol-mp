// Stub para RED phase — implementación real en GREEN.
export type ProductLookup = Record<
  string,
  {
    variantId: string
    productId: string
    artisanId: string
    basePrice: number
    priceModifier: number
    snapshotTitle: string
  }
>

export type CheckoutInput = {
  email: string
  buyer_id: string | null
  items: Array<{ variantId: string; qty: number }>
  address: {
    fullName: string
    line1: string
    line2?: string
    city: string
    region: string
    countryCode: 'CL'
    postalCode?: string
    phone?: string
  }
  shipments: Array<{ artisanId: string; courier: 'chilexpress' | 'starken' | 'flat_rate'; costClp: number }>
  couponCode?: string
  acceptedDisclaimers: true
}

export type Totals = {
  subtotal: number
  discount: number
  shippingTotal: number
  commission: number
  total: number
  perArtisan: Array<{ artisanId: string; subtotal: number; shipping: number; commission: number; artisanNet: number }>
}

export function computeTotals(_input: {
  items: Array<{ variantId: string; qty: number }>
  shipments: Array<{ artisanId: string; courier: 'chilexpress' | 'starken' | 'flat_rate'; costClp: number }>
  productLookup: ProductLookup
  commissionPct: number
  reservedDiscount: number
}): Totals {
  throw new Error('not implemented')
}
