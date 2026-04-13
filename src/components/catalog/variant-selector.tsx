'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { getVariantPrice } from '@/lib/utils/format'
import type { Database } from '@/types/database.types'

type ProductVariantRow = Database['public']['Tables']['product_variant']['Row']

interface VariantSelectorProps {
  variants: ProductVariantRow[]
  basePrice: number
  onPriceChange: (price: number) => void
}

type VariantAttribute = 'size' | 'material' | 'color' | 'stones'

const ATTRIBUTE_LABELS: Record<VariantAttribute, string> = {
  size: 'Talla',
  material: 'Material',
  color: 'Color',
  stones: 'Piedras',
}

interface VariantGroup {
  attribute: VariantAttribute
  label: string
  options: { value: string; variant: ProductVariantRow }[]
}

export function VariantSelector({ variants, basePrice, onPriceChange }: VariantSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const groups = useMemo(() => {
    const result: VariantGroup[] = []
    const attributes: VariantAttribute[] = ['size', 'material', 'color', 'stones']

    for (const attr of attributes) {
      const options: VariantGroup['options'] = []
      for (const v of variants) {
        const val = v[attr]
        if (val) {
          options.push({ value: val, variant: v })
        }
      }
      if (options.length > 0) {
        result.push({
          attribute: attr,
          label: ATTRIBUTE_LABELS[attr],
          options,
        })
      }
    }
    return result
  }, [variants])

  const selectedVariant = variants.find(v => v.id === selectedId) ?? null

  function handleSelect(variant: ProductVariantRow) {
    setSelectedId(variant.id)
    onPriceChange(getVariantPrice(basePrice, variant.price_modifier))
  }

  if (groups.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      {groups.map(group => (
        <div key={group.attribute} className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700">{group.label}:</span>
          <div className="flex flex-wrap gap-2">
            {group.options.map(({ value, variant }) => {
              const isSelected = selectedId === variant.id
              const isDisabled = variant.stock === 0 || !variant.is_available
              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={isDisabled}
                  className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isDisabled
                      ? 'cursor-not-allowed bg-zinc-300 text-zinc-500 line-through'
                      : isSelected
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
                  }`}
                  onClick={() => handleSelect(variant)}
                >
                  {value}
                </button>
              )
            })}
          </div>
          {/* Low stock warning */}
          {selectedVariant &&
            group.options.some(o => o.variant.id === selectedId) &&
            selectedVariant.stock > 0 &&
            selectedVariant.stock <= 5 && (
              <Badge className="w-fit bg-amber-500 text-white">
                Quedan {selectedVariant.stock} unidades
              </Badge>
            )}
        </div>
      ))}
    </div>
  )
}
