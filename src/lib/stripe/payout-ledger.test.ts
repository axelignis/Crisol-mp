import { describe, it, expect } from 'vitest'
import { buildPayoutLedger } from './payout-ledger'

const A1 = '00000000-0000-0000-0000-000000000a01'
const A2 = '00000000-0000-0000-0000-000000000a02'
const A3 = '00000000-0000-0000-0000-000000000a03'

describe('buildPayoutLedger', () => {
  it('sin descuento: artisan_net = gross - commission + shipping', () => {
    const ledger = buildPayoutLedger({
      perArtisan: [
        { artisanId: A1, subtotal: 50000, shipping: 4000, commission: 5000, artisanNet: 50000 - 5000 + 4000 },
      ],
      discount: 0,
      subtotal: 50000,
      shippingTotal: 4000,
    })
    expect(ledger).toHaveLength(1)
    expect(ledger[0]).toMatchObject({
      artisanId: A1,
      gross: 50000,
      commissionGross: 5000,
      discountAbsorbedByCommission: 0,
      shippingClp: 4000,
      netToArtisan: 49000,
    })
  })

  it('descuento absorbido proporcional por la comisión total — artisan_net intacto', () => {
    // 2 artesanos, comisión total = 4000+1500 = 5500. discount=2000 → cubre por commission, plataforma absorbe.
    const ledger = buildPayoutLedger({
      perArtisan: [
        { artisanId: A1, subtotal: 40000, shipping: 3000, commission: 4000, artisanNet: 39000 },
        { artisanId: A2, subtotal: 15000, shipping: 2000, commission: 1500, artisanNet: 15500 },
      ],
      discount: 2000,
      subtotal: 55000,
      shippingTotal: 5000,
    })
    expect(ledger).toHaveLength(2)
    // artisan_net no toca discount
    expect(ledger[0].netToArtisan).toBe(39000)
    expect(ledger[1].netToArtisan).toBe(15500)
    // discount distribuido proporcional al subtotal por artesano
    const sumAbsorbed = ledger.reduce((s, l) => s + l.discountAbsorbedByCommission, 0)
    expect(sumAbsorbed).toBe(2000)
  })

  it('descuento > comisión total: plataforma queda negativa, artisans intactos', () => {
    const ledger = buildPayoutLedger({
      perArtisan: [
        { artisanId: A1, subtotal: 30000, shipping: 4000, commission: 3000, artisanNet: 31000 },
      ],
      discount: 10000, // mucho mayor que commission=3000
      subtotal: 30000,
      shippingTotal: 4000,
    })
    expect(ledger[0].netToArtisan).toBe(31000) // intacto
    // Plataforma: commission_total - discount = 3000 - 10000 = -7000 (absorbed)
    const platformNet = ledger.reduce((s, l) => s + (l.commissionGross - l.discountAbsorbedByCommission), 0)
    expect(platformNet).toBe(-7000)
  })

  it('invariant: sum(netToArtisan) + platformNet = subtotal - discount + shippingTotal', () => {
    const cases = [
      { perArtisan: [
          { artisanId: A1, subtotal: 50000, shipping: 4000, commission: 5000, artisanNet: 49000 },
          { artisanId: A2, subtotal: 20000, shipping: 3000, commission: 2000, artisanNet: 21000 },
          { artisanId: A3, subtotal: 10000, shipping: 2500, commission: 1000, artisanNet: 11500 },
        ], discount: 5000, subtotal: 80000, shippingTotal: 9500 },
      { perArtisan: [
          { artisanId: A1, subtotal: 100000, shipping: 5000, commission: 10000, artisanNet: 95000 },
        ], discount: 0, subtotal: 100000, shippingTotal: 5000 },
      { perArtisan: [
          { artisanId: A1, subtotal: 7000, shipping: 4000, commission: 700, artisanNet: 10300 },
        ], discount: 12000, subtotal: 7000, shippingTotal: 4000 },
    ]
    for (const c of cases) {
      const ledger = buildPayoutLedger(c)
      const sumNet = ledger.reduce((s, l) => s + l.netToArtisan, 0)
      const platform = ledger.reduce((s, l) => s + (l.commissionGross - l.discountAbsorbedByCommission), 0)
      const expectedTotal = c.subtotal - Math.min(c.discount, c.subtotal) + c.shippingTotal
      expect(sumNet + platform).toBe(expectedTotal)
    }
  })

  it('discount=subtotal (cap): comisión queda completa, plataforma absorbe el subtotal entero como descuento', () => {
    const ledger = buildPayoutLedger({
      perArtisan: [
        { artisanId: A1, subtotal: 10000, shipping: 3000, commission: 1000, artisanNet: 12000 },
      ],
      discount: 10000,
      subtotal: 10000,
      shippingTotal: 3000,
    })
    expect(ledger[0].netToArtisan).toBe(12000)
    expect(ledger[0].discountAbsorbedByCommission).toBe(10000)
  })
})
