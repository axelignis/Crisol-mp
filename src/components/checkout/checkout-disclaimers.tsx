'use client'
import { useTranslations } from 'next-intl'

type Props = {
  accepted: boolean
  onChange: (v: boolean) => void
}

// D-19, COMR-03, COMR-09: disclaimers obligatorios inline + checkbox antes del botón Pagar.
export function CheckoutDisclaimers({ accepted, onChange }: Props) {
  const t = useTranslations('checkout.disclaimers')
  return (
    <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-5">
      <ul className="list-disc space-y-2 pl-5 text-sm text-amber-900">
        <li>{t('noReturns')}</li>
        <li>{t('intlTax')}</li>
      </ul>
      <label className="flex items-start gap-2 text-sm text-zinc-800">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-zinc-400"
          data-testid="checkout-disclaimers-accept"
        />
        <span>{t('acceptCheckbox')}</span>
      </label>
    </section>
  )
}
