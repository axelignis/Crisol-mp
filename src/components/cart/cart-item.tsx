'use client'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { MinusIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { formatCLP } from '@/lib/utils/format'
import type { CartItem as CartItemType } from '@/types/cart'
import { useCart } from '@/hooks/use-cart'

interface CartItemProps {
  item: CartItemType
}

export function CartItem({ item }: CartItemProps) {
  const t = useTranslations('cart')
  const { setQty, remove } = useCart()
  const lineTotal = item.unitPrice * item.qty

  return (
    <div
      className="flex gap-3 border-b border-zinc-100 py-3"
      data-testid="cart-item"
      data-variant-id={item.variantId}
    >
      <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-zinc-100">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.title}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <p className="text-sm font-medium text-zinc-900 line-clamp-2">
          {item.title}
        </p>
        <p className="text-xs text-zinc-500">{formatCLP(item.unitPrice)}</p>

        <div className="mt-1 flex items-center gap-2">
          <div className="inline-flex items-center rounded-md border border-zinc-200">
            <button
              type="button"
              aria-label={t('decrease')}
              onClick={() => setQty(item.variantId, item.qty - 1)}
              className="inline-flex size-7 items-center justify-center text-zinc-700 hover:bg-zinc-50"
            >
              <MinusIcon className="size-3.5" />
            </button>
            <span
              className="min-w-7 text-center text-sm tabular-nums"
              data-testid="cart-item-qty"
            >
              {item.qty}
            </span>
            <button
              type="button"
              aria-label={t('increase')}
              onClick={() => setQty(item.variantId, item.qty + 1)}
              className="inline-flex size-7 items-center justify-center text-zinc-700 hover:bg-zinc-50"
            >
              <PlusIcon className="size-3.5" />
            </button>
          </div>

          <button
            type="button"
            aria-label={t('remove')}
            onClick={() => remove(item.variantId)}
            className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
            data-testid="cart-item-remove"
          >
            <Trash2Icon className="size-4" />
          </button>
        </div>
      </div>

      <div className="text-sm font-medium text-zinc-900">
        {formatCLP(lineTotal)}
      </div>
    </div>
  )
}
