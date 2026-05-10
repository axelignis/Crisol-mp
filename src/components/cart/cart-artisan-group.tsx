'use client'
// Agrupa items por artesano (D-03 multi-artisan UI).
import { useTranslations } from 'next-intl'
import { formatCLP } from '@/lib/utils/format'
import { CartItem } from '@/components/cart/cart-item'
import type { CartItemsByArtisan } from '@/types/cart'

interface CartArtisanGroupProps {
  group: CartItemsByArtisan
}

export function CartArtisanGroup({ group }: CartArtisanGroupProps) {
  const t = useTranslations('cart')
  return (
    <section
      className="border-b border-zinc-100 last:border-0"
      data-testid="cart-artisan-group"
      data-artisan-id={group.artisanId}
    >
      <header className="flex items-center justify-between gap-3 px-1 pt-3 pb-1">
        <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {t('artisanGroup', { artisan: group.artisanName })}
        </h4>
        <span className="text-xs text-zinc-500" data-testid="cart-group-subtotal">
          {formatCLP(group.subtotal)}
        </span>
      </header>
      <div className="flex flex-col">
        {group.items.map((item) => (
          <CartItem key={item.variantId} item={item} />
        ))}
      </div>
    </section>
  )
}
