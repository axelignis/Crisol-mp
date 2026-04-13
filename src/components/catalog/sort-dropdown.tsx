'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import type { CatalogFilters } from '@/types/catalog.types'

const SORT_OPTIONS: CatalogFilters['orden'][] = ['reciente', 'precio_asc', 'precio_desc']

interface SortDropdownProps {
  currentOrder: CatalogFilters['orden']
}

export function SortDropdown({ currentOrder }: SortDropdownProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('catalog')

  function handleChange(value: CatalogFilters['orden'] | null) {
    if (!value) return
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'reciente') {
      params.delete('orden')
    } else {
      params.set('orden', value)
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <Select value={currentOrder} onValueChange={handleChange}>
      <SelectTrigger size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option} value={option}>
            {t(`sort.${option}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
