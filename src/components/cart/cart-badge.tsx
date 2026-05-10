'use client'
// Badge contador del header. Si !hydrated no renderiza número (evita flicker 0→N).
import { ShoppingBagIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCart } from '@/hooks/use-cart'

export function CartBadge() {
  const t = useTranslations('cart')
  const { count, hydrated } = useCart()

  return (
    <span className="relative inline-flex items-center" aria-label={t('open')}>
      <ShoppingBagIcon className="size-5 text-zinc-700" aria-hidden="true" />
      {hydrated && count > 0 && (
        <span
          className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900 px-1.5 text-xs font-medium text-white"
          data-testid="cart-badge-count"
        >
          {count}
        </span>
      )}
    </span>
  )
}
