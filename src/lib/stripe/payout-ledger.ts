// Phase 3 Plan 04 — Payout ledger (D-SPLIT, D-07 single-account, D-15 platform absorbs discount).
// Consumido por el webhook (Plan 05) para crear `artisan_payout` rows.
// REGLA: el descuento NUNCA reduce artisan_net. La plataforma lo absorbe contra
// la comisión total (distribuido proporcional al subtotal por artesano). Si excede
// la comisión, la plataforma queda con margen negativo.
//
// INVARIANTE: sum(netToArtisan) + platformNet = subtotal - discount + shippingTotal
// donde platformNet = sum(commissionGross - discountAbsorbedByCommission).

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

export function buildPayoutLedger(input: LedgerInput): LedgerEntry[] {
  const { perArtisan, discount, subtotal } = input
  const cappedDiscount = Math.min(Math.max(0, discount), subtotal)

  // Distribuir descuento proporcional al subtotal por artesano.
  // Usamos floor + ajuste del último para garantizar exact sum (no rounding loss).
  const distributions: number[] = []
  let assigned = 0
  for (let i = 0; i < perArtisan.length; i++) {
    if (i === perArtisan.length - 1) {
      distributions.push(cappedDiscount - assigned)
    } else {
      const share = subtotal > 0 ? Math.floor((cappedDiscount * perArtisan[i].subtotal) / subtotal) : 0
      distributions.push(share)
      assigned += share
    }
  }

  return perArtisan.map((a, idx) => ({
    artisanId: a.artisanId,
    gross: a.subtotal,
    commissionGross: a.commission,
    discountAbsorbedByCommission: distributions[idx],
    shippingClp: a.shipping,
    // artisan_net intacto: ya viene calculado como (subtotal - commission) + shipping
    netToArtisan: a.artisanNet,
  }))
}
