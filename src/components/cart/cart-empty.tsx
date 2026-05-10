'use client'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ShoppingBagIcon } from 'lucide-react'

export function CartEmpty() {
  const t = useTranslations('cart')
  const locale = useLocale()
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <ShoppingBagIcon className="size-10 text-zinc-300" aria-hidden="true" />
      <h3 className="text-base font-medium text-zinc-900">{t('empty')}</h3>
      <p className="max-w-xs text-sm text-zinc-500">{t('emptyHint')}</p>
      <Link
        href={`/${locale}/catalogo`}
        className="mt-2 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        {t('exploreCatalog')}
      </Link>
    </div>
  )
}
