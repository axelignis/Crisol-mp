'use client'
import { useTranslations } from 'next-intl'

type Props = {
  email: string
  onChange: (v: string) => void
  readOnly?: boolean
}

export function CheckoutContact({ email, onChange, readOnly }: Props) {
  const t = useTranslations('checkout.contact')
  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-medium text-zinc-900">{t('email')}</h2>
      <p className="text-sm text-zinc-500">{t('emailLabel')}</p>
      <input
        type="email"
        required
        readOnly={readOnly}
        value={email}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none disabled:bg-zinc-50"
        placeholder="comprador@ejemplo.cl"
      />
    </section>
  )
}
