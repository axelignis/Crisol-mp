'use client'
import { useTranslations } from 'next-intl'

type Props = {
  itemsCount: number
  subtotal: number
  discount: number
  shippingTotal: number
  total: number
}

// T-03-12: NO renderiza commission al buyer.
export function OrderSummary({ itemsCount, subtotal, discount, shippingTotal, total }: Props) {
  const t = useTranslations('checkout.summary')
  const fmt = (n: number) => `$${n.toLocaleString('es-CL')}`
  return (
    <aside className="sticky top-24 h-fit space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-medium text-zinc-900">{t('items', { count: itemsCount })}</h2>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-zinc-600">{t('subtotal')}</dt>
          <dd>{fmt(subtotal)}</dd>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-emerald-700">
            <dt>{t('discount')}</dt>
            <dd>−{fmt(discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-zinc-600">{t('shipping')}</dt>
          <dd>{fmt(shippingTotal)}</dd>
        </div>
        <div className="my-2 border-t border-zinc-200" />
        <div className="flex justify-between text-base font-semibold">
          <dt>{t('total')}</dt>
          <dd>{fmt(total)}</dd>
        </div>
      </dl>
    </aside>
  )
}
