/** CLP is Chile's zero-decimal currency. All values are integers. */
export type CLP = number & { readonly __brand: 'CLP' }

export function clp(amount: number): CLP {
  if (!Number.isInteger(amount)) {
    throw new Error(`CLP amount must be integer, got ${amount}`)
  }
  if (amount < 0) {
    throw new Error(`CLP amount must be non-negative, got ${amount}`)
  }
  return amount as CLP
}

export function clpAdd(a: CLP, b: CLP): CLP {
  return (a + b) as CLP
}

export function clpSubtract(a: CLP, b: CLP): CLP {
  const result = a - b
  if (result < 0) {
    throw new Error(`CLP subtraction would result in negative: ${a} - ${b}`)
  }
  return result as CLP
}

export function clpMultiply(amount: CLP, factor: number): CLP {
  if (!Number.isInteger(factor)) {
    throw new Error(`CLP multiply factor must be integer, got ${factor}`)
  }
  return (amount * factor) as CLP
}

export function clpPercentFloor(amount: CLP, percent: number): CLP {
  return Math.floor(amount * percent / 100) as CLP
}
