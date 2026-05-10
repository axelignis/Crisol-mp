'use client'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

export type ShippingSelection = {
  artisanId: string
  artisanName: string
  courier: 'chilexpress' | 'starken' | 'flat_rate'
  costClp: number
}

type Props = {
  selections: ShippingSelection[]
  onQuoteRequest: () => Promise<void>
  loading: boolean
}

export function CheckoutShipping({ selections, onQuoteRequest, loading }: Props) {
  const t = useTranslations('checkout.shipping')
  const [requested, setRequested] = useState(false)
  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-medium text-zinc-900">{t('title')}</h2>
      {selections.length === 0 && !requested ? (
        <button
          type="button"
          onClick={async () => { setRequested(true); await onQuoteRequest() }}
          disabled={loading}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? t('quoting') : t('quote')}
        </button>
      ) : null}
      {loading && <p className="text-sm text-zinc-500">{t('quoting')}</p>}
      <ul className="space-y-2">
        {selections.map((s) => (
          <li key={s.artisanId} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm">
            <div>
              <div className="font-medium text-zinc-800">{t('perArtisan')}: {s.artisanName}</div>
              <div className="text-xs text-zinc-500">{t('courier')}: {s.courier}</div>
              {s.courier === 'flat_rate' && (
                <div className="text-xs text-amber-600">{t('timeoutFallback')}</div>
              )}
            </div>
            <div className="font-medium">${s.costClp.toLocaleString('es-CL')} CLP</div>
          </li>
        ))}
      </ul>
    </section>
  )
}
