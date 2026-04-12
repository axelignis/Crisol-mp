import { clp, clpPercentFloor, clpSubtract, type CLP } from './clp'

export interface CommissionSplit {
  total: CLP
  commission: CLP
  artisanNet: CLP
  commissionPct: number
}

/**
 * Calculate platform commission split for an order amount.
 * Commission is floored; artisan gets the remainder.
 * Guarantees: commission + artisanNet === total (no rounding loss).
 */
export function calculateSplit(totalAmount: number, commissionPct: number): CommissionSplit {
  if (commissionPct < 0 || commissionPct > 50) {
    throw new Error(`commission_pct must be between 0 and 50, got ${commissionPct}`)
  }
  const total = clp(totalAmount)
  const commission = clpPercentFloor(total, commissionPct)
  const artisanNet = clpSubtract(total, commission)

  return { total, commission, artisanNet, commissionPct }
}
