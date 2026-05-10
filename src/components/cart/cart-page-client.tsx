'use client'
// Vista full-page del carrito (D-01). Layout 2 columnas en desktop.
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useCart } from '@/hooks/use-cart'
import { CartArtisanGroup } from '@/components/cart/cart-artisan-group'
import { CartEmpty } from '@/components/cart/cart-empty'
import { formatCLP } from '@/lib/utils/format'

export function CartPageClient() {
  const t = useTranslations('cart')
  const locale = useLocale()
  const { byArtisan, items, subtotal, count, hydrated } = useCart()

  const isEmpty = !hydrated || items.length === 0

  if (isEmpty) {
    return (
      <div className="mx-auto max-w-3xl py-16">
        <CartEmpty />
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-3">
      <section className="lg:col-span-2" data-testid="cart-page-items">
        <h1 className="mb-4 text-2xl font-semibold text-zinc-900">{t('title')}</h1>
        <p className="mb-6 text-sm text-zinc-500">{t('items', { count })}</p>
        <div className="rounded-xl border border-zinc-100 bg-white px-4">
          {byArtisan.map((group) => (
            <CartArtisanGroup key={group.artisanId} group={group} />
          ))}
        </div>
      </section>

      <aside className="lg:col-span-1">
        <div
          className="sticky top-20 rounded-xl border border-zinc-100 bg-white p-5"
          data-testid="cart-page-summary"
        >
          <h2 className="mb-3 text-base font-semibold text-zinc-900">
            {t('summary')}
          </h2>
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 text-sm">
            <span className="text-zinc-600">{t('subtotal')}</span>
            <span
              className="font-semibold text-zinc-900"
              data-testid="cart-page-subtotal"
            >
              {formatCLP(subtotal)}
            </span>
          </div>
          <p className="my-3 text-xs text-zinc-500">{t('shippingNote')}</p>
          <Link
            href={`/${locale}/checkout`}
            className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800"
            data-testid="cart-page-checkout-cta"
          >
            {t('checkout')}
          </Link>
          <p className="mt-3 text-[11px] text-zinc-500">{t('stockNote')}</p>
        </div>
      </aside>
    </div>
  )
}
