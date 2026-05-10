'use client'
// D-01 Cart Sheet (slide-over). Render condicional según hidratación + estado vacío.
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { CartBadge } from '@/components/cart/cart-badge'
import { CartEmpty } from '@/components/cart/cart-empty'
import { CartArtisanGroup } from '@/components/cart/cart-artisan-group'
import { useCart } from '@/hooks/use-cart'
import { formatCLP } from '@/lib/utils/format'

export function CartSheet() {
  const t = useTranslations('cart')
  const locale = useLocale()
  const { items, byArtisan, subtotal, count, hydrated } = useCart()

  const isEmpty = !hydrated || items.length === 0

  return (
    <Sheet>
      <SheetTrigger
        render={
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-md hover:bg-zinc-100"
            data-testid="cart-trigger"
            aria-label={t('open')}
          >
            <CartBadge />
          </button>
        }
      />


      <SheetContent
        side="right"
        className="w-full sm:max-w-md"
        data-testid="cart-sheet"
      >
        <SheetHeader>
          <SheetTitle>{t('title')}</SheetTitle>
          {hydrated && count > 0 && (
            <SheetDescription>{t('items', { count })}</SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {isEmpty ? (
            <CartEmpty />
          ) : (
            <div className="flex flex-col">
              {byArtisan.map((group) => (
                <CartArtisanGroup key={group.artisanId} group={group} />
              ))}
            </div>
          )}
        </div>

        {!isEmpty && (
          <SheetFooter className="border-t border-zinc-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-600">{t('subtotal')}</span>
              <span
                className="text-base font-semibold text-zinc-900"
                data-testid="cart-subtotal"
              >
                {formatCLP(subtotal)}
              </span>
            </div>
            <p className="text-xs text-zinc-500">{t('shippingNote')}</p>
            <Link
              href={`/${locale}/checkout`}
              className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800"
              data-testid="cart-checkout-cta"
            >
              {t('checkout')}
            </Link>
            <Link
              href={`/${locale}/carrito`}
              className="text-center text-xs text-zinc-500 underline-offset-2 hover:underline"
            >
              {t('viewFullCart')}
            </Link>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
