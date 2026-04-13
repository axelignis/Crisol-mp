import { formatCLP, getVariantPrice } from '@/lib/utils/format'

interface PriceDisplayProps {
  amount: number
  modifier?: number
  className?: string
}

export function PriceDisplay({ amount, modifier, className }: PriceDisplayProps) {
  const price = modifier !== undefined ? getVariantPrice(amount, modifier) : amount

  return (
    <span className={className ?? 'text-sm font-semibold'}>
      {formatCLP(price)}
    </span>
  )
}
