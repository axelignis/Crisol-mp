import { describe, it, expect } from 'vitest'
import { calculateSplit } from '@/lib/utils/commission'

describe('calculateSplit', () => {
  it('splits 10000 at 10%', () => {
    const r = calculateSplit(10000, 10)
    expect(r.total).toBe(10000)
    expect(r.commission).toBe(1000)
    expect(r.artisanNet).toBe(9000)
    expect(r.commissionPct).toBe(10)
  })

  it('floors commission: 999 at 10%', () => {
    const r = calculateSplit(999, 10)
    expect(r.total).toBe(999)
    expect(r.commission).toBe(99)
    expect(r.artisanNet).toBe(900)
  })

  it('floors to zero: 1 at 10%', () => {
    const r = calculateSplit(1, 10)
    expect(r.total).toBe(1)
    expect(r.commission).toBe(0)
    expect(r.artisanNet).toBe(1)
  })

  it('splits 100000 at 15%', () => {
    const r = calculateSplit(100000, 15)
    expect(r.commission).toBe(15000)
    expect(r.artisanNet).toBe(85000)
  })

  it('handles 0% commission', () => {
    const r = calculateSplit(1000, 0)
    expect(r.commission).toBe(0)
    expect(r.artisanNet).toBe(1000)
  })

  it('handles 50% commission', () => {
    const r = calculateSplit(1000, 50)
    expect(r.commission).toBe(500)
    expect(r.artisanNet).toBe(500)
  })

  it('throws on negative commission', () => {
    expect(() => calculateSplit(1000, -1)).toThrow()
  })

  it('throws on commission > 50', () => {
    expect(() => calculateSplit(1000, 51)).toThrow()
  })

  it('invariant: commission + artisanNet === total for all valid inputs', () => {
    const percentages = [0, 1, 5, 10, 15, 25, 33, 50]

    for (const pct of percentages) {
      // Test amounts 1-100
      for (let amount = 1; amount <= 100; amount++) {
        const r = calculateSplit(amount, pct)
        expect(r.commission + r.artisanNet).toBe(r.total)
      }
      // Test amounts 200-10000 in steps of 100
      for (let amount = 200; amount <= 10000; amount += 100) {
        const r = calculateSplit(amount, pct)
        expect(r.commission + r.artisanNet).toBe(r.total)
      }
    }
  })
})
