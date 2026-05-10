// Phase 3 Plan 04 — Server-canonical totals (D-14, D-15).
// Cliente nunca calcula totales; este módulo es la única fuente de verdad
// invocada por /api/checkout/payment-intent y por el webhook.
import { calculateSplit } from '@/lib/utils/commission'

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

export type PerArtisanTotal = {
  artisanId: string
  subtotal: number
  shipping: number
  commission: number
  artisanNet: number
}

// Item-level snapshot consumido por el webhook (Plan 05) para crear order_item
// con snapshot_title y unit_price inmutables (D-20, COMR-08).
export type PerItemTotal = {
  variantId: string
  productId: string
  artisanId: string
  qty: number
  unitPrice: number
  totalPrice: number
  snapshotTitle: string
}

export type Totals = {
  subtotal: number
  discount: number
  shippingTotal: number
  commission: number
  total: number
  perArtisan: PerArtisanTotal[]
  perItem: PerItemTotal[]
}

export type ComputeTotalsInput = {
  items: Array<{ variantId: string; qty: number }>
  shipments: Array<{ artisanId: string; courier: 'chilexpress' | 'starken' | 'flat_rate'; costClp: number }>
  productLookup: ProductLookup
  commissionPct: number
  reservedDiscount: number
}

export function computeTotals(input: ComputeTotalsInput): Totals {
  const { items, shipments, productLookup, commissionPct, reservedDiscount } = input

  // Validar que cada item tenga lookup
  for (const it of items) {
    if (!productLookup[it.variantId]) {
      throw new Error(`computeTotals: variant ${it.variantId} missing in productLookup`)
    }
  }

  // Agrupar items por artesano (orden de inserción) y persistir snapshot per-item
  const perArtisanMap = new Map<string, PerArtisanTotal>()
  const perItem: PerItemTotal[] = []
  let subtotal = 0
  for (const it of items) {
    const prod = productLookup[it.variantId]
    const unit = prod.basePrice + (prod.priceModifier || 0)
    const lineTotal = unit * it.qty
    subtotal += lineTotal
    perItem.push({
      variantId: it.variantId,
      productId: prod.productId,
      artisanId: prod.artisanId,
      qty: it.qty,
      unitPrice: unit,
      totalPrice: lineTotal,
      snapshotTitle: prod.snapshotTitle,
    })
    const existing = perArtisanMap.get(prod.artisanId)
    if (existing) {
      existing.subtotal += lineTotal
    } else {
      perArtisanMap.set(prod.artisanId, {
        artisanId: prod.artisanId,
        subtotal: lineTotal,
        shipping: 0,
        commission: 0,
        artisanNet: 0,
      })
    }
  }

  // Asignar shipping per artesano (debe haber 1 shipment por artesano)
  for (const a of perArtisanMap.values()) {
    const ship = shipments.find((s) => s.artisanId === a.artisanId)
    if (!ship) {
      throw new Error(`computeTotals: missing shipment for artisan ${a.artisanId}`)
    }
    a.shipping = ship.costClp
  }

  // Calcular comisión per artesano usando calculateSplit (no hardcode)
  let commissionTotal = 0
  for (const a of perArtisanMap.values()) {
    const split = calculateSplit(a.subtotal, commissionPct)
    a.commission = split.commission
    // artisan_net = (subtotal - commission) + shipping
    // D-15: descuento NO toca artisan_net (plataforma absorbe contra comisión)
    a.artisanNet = split.artisanNet + a.shipping
    commissionTotal += split.commission
  }

  // Discount cap al subtotal (D-14)
  const discount = Math.min(Math.max(0, reservedDiscount), subtotal)

  const shippingTotal = shipments.reduce((s, x) => s + x.costClp, 0)
  const total = subtotal - discount + shippingTotal

  return {
    subtotal,
    discount,
    shippingTotal,
    commission: commissionTotal,
    total,
    perArtisan: Array.from(perArtisanMap.values()),
    perItem,
  }
}
