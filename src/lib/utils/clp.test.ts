import { describe, it, expect } from 'vitest'
import { clp, clpAdd, clpSubtract, clpMultiply, clpPercentFloor } from '@/lib/utils/clp'

describe('clp', () => {
  it('returns 100 as CLP branded type', () => {
    expect(clp(100)).toBe(100)
  })

  it('throws on non-integer amount', () => {
    expect(() => clp(10.5)).toThrow('integer')
  })

  it('throws on negative amount', () => {
    expect(() => clp(-1)).toThrow('non-negative')
  })

  it('accepts zero', () => {
    expect(clp(0)).toBe(0)
  })
})

describe('clpAdd', () => {
  it('adds two CLP values', () => {
    expect(clpAdd(clp(100), clp(200))).toBe(300)
  })
})

describe('clpSubtract', () => {
  it('subtracts two CLP values', () => {
    expect(clpSubtract(clp(300), clp(100))).toBe(200)
  })

  it('throws when result would be negative', () => {
    expect(() => clpSubtract(clp(100), clp(300))).toThrow('negative')
  })
})

describe('clpMultiply', () => {
  it('multiplies CLP by integer factor', () => {
    expect(clpMultiply(clp(1000), 3)).toBe(3000)
  })
})

describe('clpPercentFloor', () => {
  it('calculates 10% of 1000', () => {
    expect(clpPercentFloor(clp(1000), 10)).toBe(100)
  })

  it('floors 10% of 999 to 99', () => {
    expect(clpPercentFloor(clp(999), 10)).toBe(99)
  })

  it('floors 10% of 1 to 0', () => {
    expect(clpPercentFloor(clp(1), 10)).toBe(0)
  })

  it('handles large values: 10% of 100000', () => {
    expect(clpPercentFloor(clp(100000), 10)).toBe(10000)
  })
})
