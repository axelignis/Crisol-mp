export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function getVariantPrice(basePrice: number, priceModifier: number): number {
  return Math.max(0, basePrice + priceModifier)
}
