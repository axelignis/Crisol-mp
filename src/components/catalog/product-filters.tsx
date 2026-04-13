'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatCLP } from '@/lib/utils/format'
import type { CatalogFilters, FilterOptions, FilterOption } from '@/types/catalog.types'
import { SlidersHorizontalIcon } from 'lucide-react'

interface ProductFiltersProps {
  filterOptions: FilterOptions
  currentFilters: CatalogFilters
}

export function ProductFilters({ filterOptions, currentFilters }: ProductFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('catalog')

  const activeCount = useMemo(() => {
    let count = 0
    if (currentFilters.tipo?.length) count += currentFilters.tipo.length
    if (currentFilters.material?.length) count += currentFilters.material.length
    if (currentFilters.ocasion?.length) count += currentFilters.ocasion.length
    if (currentFilters.tecnica?.length) count += currentFilters.tecnica.length
    if (currentFilters.precio_min !== undefined) count++
    if (currentFilters.precio_max !== undefined) count++
    return count
  }, [currentFilters])

  const updateParams = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      // Reset page on filter change
      params.delete('pagina')
      router.push(`?${params.toString()}`)
    },
    [router, searchParams]
  )

  const toggleCheckbox = useCallback(
    (key: string, slug: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const current = params.get(key)?.split(',').filter(Boolean) ?? []
      const updated = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug]
      if (updated.length > 0) {
        params.set(key, updated.join(','))
      } else {
        params.delete(key)
      }
      params.delete('pagina')
      router.push(`?${params.toString()}`)
    },
    [router, searchParams]
  )

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams()
    const orden = searchParams.get('orden')
    if (orden) params.set('orden', orden)
    router.push(`?${params.toString()}`)
  }, [router, searchParams])

  const handlePriceChange = useCallback(
    (values: number | readonly number[]) => {
      const params = new URLSearchParams(searchParams.toString())
      const arr = Array.isArray(values) ? values : [values, values]
      const [min, max] = arr
      if (min > filterOptions.precio_min) {
        params.set('precio_min', String(min))
      } else {
        params.delete('precio_min')
      }
      if (max < filterOptions.precio_max) {
        params.set('precio_max', String(max))
      } else {
        params.delete('precio_max')
      }
      params.delete('pagina')
      router.push(`?${params.toString()}`)
    },
    [router, searchParams, filterOptions.precio_min, filterOptions.precio_max]
  )

  function CheckboxGroup({
    label,
    paramKey,
    options,
  }: {
    label: string
    paramKey: string
    options: FilterOption[]
  }) {
    const selected = searchParams.get(paramKey)?.split(',').filter(Boolean) ?? []
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">{label}</h4>
        <div className="space-y-1.5">
          {options.map((option) => (
            <label key={option.slug} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(option.slug)}
                onChange={() => toggleCheckbox(paramKey, option.slug)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span>{option.name}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  const filterContent = (
    <div className="space-y-4">
      {/* Tipo de pieza */}
      <CheckboxGroup
        label={t('filters.tipo')}
        paramKey="tipo"
        options={filterOptions.tipos}
      />
      <Separator />

      {/* Material */}
      {filterOptions.materiales.length > 0 && (
        <>
          <CheckboxGroup
            label={t('filters.material')}
            paramKey="material"
            options={filterOptions.materiales}
          />
          <Separator />
        </>
      )}

      {/* Price range */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">{t('filters.precio')}</h4>
        <Slider
          min={filterOptions.precio_min}
          max={filterOptions.precio_max}
          defaultValue={[
            currentFilters.precio_min ?? filterOptions.precio_min,
            currentFilters.precio_max ?? filterOptions.precio_max,
          ]}
          onValueCommitted={handlePriceChange}
        />
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{formatCLP(currentFilters.precio_min ?? filterOptions.precio_min)}</span>
          <span>{formatCLP(currentFilters.precio_max ?? filterOptions.precio_max)}</span>
        </div>
      </div>
      <Separator />

      {/* Ocasion */}
      {filterOptions.ocasiones.length > 0 && (
        <>
          <CheckboxGroup
            label={t('filters.ocasion')}
            paramKey="ocasion"
            options={filterOptions.ocasiones}
          />
          <Separator />
        </>
      )}

      {/* Tecnica */}
      {filterOptions.tecnicas.length > 0 && (
        <CheckboxGroup
          label={t('filters.tecnica')}
          paramKey="tecnica"
          options={filterOptions.tecnicas}
        />
      )}

      {/* Clear filters */}
      {activeCount > 0 && (
        <Button variant="link" size="sm" onClick={clearFilters} className="px-0">
          {t('filters.clear')}
        </Button>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 md:block">
        {filterContent}
      </aside>

      {/* Mobile filter sheet */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="outline" size="sm">
                <SlidersHorizontalIcon className="mr-1.5 size-4" />
                {t('filters.title')}
                {activeCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5">
                    {activeCount}
                  </Badge>
                )}
              </Button>
            }
          />
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t('filters.title')}</SheetTitle>
            </SheetHeader>
            <div className="p-4">
              {filterContent}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
