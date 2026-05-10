'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = {
  subtotal: number
  appliedCode: string | null
  appliedDiscount: number
  onApply: (code: string, discount: number) => void
  onClear: () => void
}

export function CheckoutCoupon({ subtotal, appliedCode, appliedDiscount, onApply, onClear }: Props) {
  const t = useTranslations('checkout.coupon')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleApply() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/checkout/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase(), subtotal }),
      })
      const json = await res.json()
      if (!json.valid) {
        const reasonMap: Record<string, string> = {
          not_found: t('invalid'),
          inactive: t('invalid'),
          expired: t('expired'),
          limit_reached: t('invalid'),
          min_order: t('minOrder', { amount: '$30.000' }),
        }
        setError(reasonMap[json.reason] ?? t('invalid'))
        return
      }
      onApply(code.trim().toUpperCase(), json.discount)
    } catch {
      setError(t('invalid'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-medium text-zinc-900">{t('title')}</h2>
      {appliedCode ? (
        <div className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span>{t('applied', { code: appliedCode })} — −${appliedDiscount.toLocaleString('es-CL')}</span>
          <button type="button" onClick={onClear} className="text-xs underline">
            {t('remove')}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={t('placeholder')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm uppercase"
          />
          <button
            type="button"
            onClick={handleApply}
            disabled={loading || code.trim().length === 0}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {t('apply')}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  )
}
