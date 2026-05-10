'use client'
import { useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe/client-browser'
import { useTranslations } from 'next-intl'

type Props = {
  clientSecret: string | null
  onConfirm: () => Promise<void>
  returnUrl: string
  disabled: boolean
  payable: boolean
  loading: boolean
}

function PaymentInner({ returnUrl, payable, disabled }: { returnUrl: string; payable: boolean; disabled: boolean }) {
  const stripe = useStripe()
  const elements = useElements()
  const t = useTranslations('checkout.payment')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)
    const { error: stripeErr } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    })
    if (stripeErr) {
      setError(stripeErr.message ?? t('error'))
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handlePay}
        disabled={!payable || submitting || disabled}
        className="w-full rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
        data-testid="checkout-pay-button"
      >
        {submitting ? t('processing') : t('payNow')}
      </button>
    </div>
  )
}

export function PaymentStripe({ clientSecret, onConfirm, returnUrl, disabled, payable, loading }: Props) {
  const t = useTranslations('checkout.payment')
  if (!clientSecret) {
    return (
      <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-medium text-zinc-900">{t('title')}</h2>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!payable || loading || disabled}
          className="w-full rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
          data-testid="checkout-init-pay-button"
        >
          {loading ? t('processing') : t('payNow')}
        </button>
      </section>
    )
  }
  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-medium text-zinc-900">{t('title')}</h2>
      <Elements stripe={getStripe()} options={{ clientSecret, locale: 'es' }}>
        <PaymentInner returnUrl={returnUrl} payable={payable} disabled={disabled} />
      </Elements>
    </section>
  )
}
