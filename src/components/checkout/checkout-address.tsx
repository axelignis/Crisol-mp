'use client'
import { useTranslations } from 'next-intl'

export type AddressValue = {
  fullName: string
  line1: string
  line2: string
  city: string
  region: string
  countryCode: 'CL'
  postalCode: string
  phone: string
}

type Props = {
  value: AddressValue
  onChange: (next: AddressValue) => void
}

export function CheckoutAddress({ value, onChange }: Props) {
  const t = useTranslations('checkout.address')
  function set<K extends keyof AddressValue>(k: K, v: AddressValue[K]) {
    onChange({ ...value, [k]: v })
  }
  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-medium text-zinc-900">{t('title')}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          required
          placeholder={t('line1')}
          value={value.fullName}
          onChange={(e) => set('fullName', e.target.value)}
          className="sm:col-span-2 rounded-md border border-zinc-300 px-3 py-2 text-sm"
          aria-label="Nombre completo"
        />
        <input
          type="text"
          required
          placeholder={t('line1')}
          value={value.line1}
          onChange={(e) => set('line1', e.target.value)}
          className="sm:col-span-2 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder={t('line2')}
          value={value.line2}
          onChange={(e) => set('line2', e.target.value)}
          className="sm:col-span-2 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          required
          placeholder={t('city')}
          value={value.city}
          onChange={(e) => set('city', e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          required
          placeholder={t('region')}
          value={value.region}
          onChange={(e) => set('region', e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder={t('phone')}
          value={value.phone}
          onChange={(e) => set('phone', e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
          {t('country')}: Chile (CL)
        </div>
      </div>
    </section>
  )
}
