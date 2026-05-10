import { describe, it, expect } from 'vitest'
import { computeTotals } from './totals'
import type { CheckoutInput, ProductLookup } from './totals'

const A1 = '00000000-0000-0000-0000-000000000a01'
const A2 = '00000000-0000-0000-0000-000000000a02'
const V1 = '00000000-0000-0000-0000-000000000001'
const V2 = '00000000-0000-0000-0000-000000000002'
const V3 = '00000000-0000-0000-0000-000000000003'

const baseInput: CheckoutInput = {
  email: 'buyer@example.com',
  buyer_id: null,
  items: [{ variantId: V1, qty: 2 }],
  address: {
    fullName: 'Comprador Test',
    line1: 'Av. Siempre Viva 123',
    city: 'Santiago',
    region: 'metropolitana',
    countryCode: 'CL',
  },
  shipments: [{ artisanId: A1, courier: 'chilexpress', costClp: 4990 }],
  acceptedDisclaimers: true,
}

const baseLookup: ProductLookup = {
  [V1]: { variantId: V1, productId: 'p1', artisanId: A1, basePrice: 30000, priceModifier: 0, snapshotTitle: 'Anillo' },
}

describe('computeTotals', () => {
  it('1 artesano single item: subtotal/total/perArtisan correctos', () => {
    const t = computeTotals({
      items: baseInput.items,
      shipments: baseInput.shipments,
      productLookup: baseLookup,
      commissionPct: 10,
      reservedDiscount: 0,
    })
    expect(t.subtotal).toBe(60000)
    expect(t.shippingTotal).toBe(4990)
    expect(t.discount).toBe(0)
    expect(t.commission).toBe(6000)
    expect(t.total).toBe(64990)
    expect(t.perArtisan).toHaveLength(1)
    expect(t.perArtisan[0]).toMatchObject({
      artisanId: A1,
      subtotal: 60000,
      shipping: 4990,
      commission: 6000,
      artisanNet: 54000 + 4990,
    })
  })

  it('2 artesanos, 3 items: agrupa per-artisan correctamente', () => {
    const items = [
      { variantId: V1, qty: 1 },
      { variantId: V2, qty: 2 },
      { variantId: V3, qty: 1 },
    ]
    const lookup: ProductLookup = {
      [V1]: { variantId: V1, productId: 'p1', artisanId: A1, basePrice: 10000, priceModifier: 0, snapshotTitle: 'X' },
      [V2]: { variantId: V2, productId: 'p2', artisanId: A2, basePrice: 5000, priceModifier: 0, snapshotTitle: 'Y' },
      [V3]: { variantId: V3, productId: 'p3', artisanId: A2, basePrice: 8000, priceModifier: 0, snapshotTitle: 'Z' },
    }
    const shipments = [
      { artisanId: A1, courier: 'chilexpress' as const, costClp: 4000 },
      { artisanId: A2, courier: 'starken' as const, costClp: 5000 },
    ]
    const t = computeTotals({ items, shipments, productLookup: lookup, commissionPct: 10, reservedDiscount: 0 })
    expect(t.subtotal).toBe(10000 + 10000 + 8000) // 28000
    expect(t.shippingTotal).toBe(9000)
    expect(t.commission).toBe(1000 + 1800) // 10% per artisan: 1000 + 1800 = 2800
    expect(t.total).toBe(28000 + 9000)
    expect(t.perArtisan).toHaveLength(2)
    const a1 = t.perArtisan.find((p) => p.artisanId === A1)!
    const a2 = t.perArtisan.find((p) => p.artisanId === A2)!
    expect(a1.subtotal).toBe(10000)
    expect(a2.subtotal).toBe(18000)
    expect(a1.shipping).toBe(4000)
    expect(a2.shipping).toBe(5000)
  })

  it('variant priceModifier sumado al unitPrice', () => {
    const lookup: ProductLookup = {
      [V1]: { variantId: V1, productId: 'p1', artisanId: A1, basePrice: 10000, priceModifier: 2500, snapshotTitle: 'Anillo XL' },
    }
    const t = computeTotals({
      items: [{ variantId: V1, qty: 2 }],
      shipments: baseInput.shipments,
      productLookup: lookup,
      commissionPct: 10,
      reservedDiscount: 0,
    })
    expect(t.subtotal).toBe(25000)
  })

  it('reservedDiscount aplica solo a subtotal, no a shipping', () => {
    const t = computeTotals({
      items: baseInput.items,
      shipments: baseInput.shipments,
      productLookup: baseLookup,
      commissionPct: 10,
      reservedDiscount: 6000, // 10% de 60000
    })
    expect(t.discount).toBe(6000)
    expect(t.total).toBe(60000 - 6000 + 4990)
  })

  it('reservedDiscount > subtotal se capa al subtotal', () => {
    const t = computeTotals({
      items: baseInput.items,
      shipments: baseInput.shipments,
      productLookup: baseLookup,
      commissionPct: 10,
      reservedDiscount: 999999,
    })
    expect(t.discount).toBe(60000)
    expect(t.total).toBe(0 + 4990)
  })

  it('throws si item.variantId falta en productLookup', () => {
    expect(() =>
      computeTotals({
        items: [{ variantId: 'missing', qty: 1 }],
        shipments: baseInput.shipments,
        productLookup: baseLookup,
        commissionPct: 10,
        reservedDiscount: 0,
      })
    ).toThrow(/lookup/i)
  })

  it('throws si shipments no cubre todos los artesanos del carrito', () => {
    const items = [
      { variantId: V1, qty: 1 },
      { variantId: V2, qty: 1 },
    ]
    const lookup: ProductLookup = {
      [V1]: { variantId: V1, productId: 'p1', artisanId: A1, basePrice: 10000, priceModifier: 0, snapshotTitle: 'X' },
      [V2]: { variantId: V2, productId: 'p2', artisanId: A2, basePrice: 5000, priceModifier: 0, snapshotTitle: 'Y' },
    }
    const shipments = [{ artisanId: A1, courier: 'chilexpress' as const, costClp: 4000 }]
    expect(() =>
      computeTotals({ items, shipments, productLookup: lookup, commissionPct: 10, reservedDiscount: 0 })
    ).toThrow(/shipment/i)
  })
})
