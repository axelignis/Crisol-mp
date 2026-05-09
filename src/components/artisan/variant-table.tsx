'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { VariantFormData, PieceType } from '@/types/catalog.types'

interface VariantTableProps {
  productId: string
  initialVariants?: VariantFormData[]
  pieceType: PieceType
  onChange: (variants: VariantFormData[]) => void
}

type VariantField = 'size' | 'material' | 'color' | 'stones'

const VARIANT_TYPES: { value: VariantField; label: string }[] = [
  { value: 'size', label: 'Talla' },
  { value: 'material', label: 'Material' },
  { value: 'color', label: 'Color' },
  { value: 'stones', label: 'Piedras' },
]

export function VariantTable({
  initialVariants = [],
  pieceType,
  onChange,
}: VariantTableProps) {
  const [variants, setVariants] = useState<
    (VariantFormData & { _field?: VariantField })[]
  >(
    initialVariants.map(v => ({
      ...v,
      _field: v.size ? 'size' : v.material ? 'material' : v.color ? 'color' : v.stones ? 'stones' : 'size',
    }))
  )

  const isUnique = pieceType === 'jewelry_unique'
  const isDecorative = pieceType === 'decorative'

  const availableTypes = isDecorative
    ? VARIANT_TYPES.filter(t => t.value !== 'size')
    : VARIANT_TYPES

  function update(updated: typeof variants) {
    setVariants(updated)
    onChange(
      updated.map(({ _field, ...v }) => {
        // Clear fields not matching selected type
        const cleaned: VariantFormData = {
          ...v,
          size: _field === 'size' ? v.size : null,
          material: _field === 'material' ? v.material : null,
          color: _field === 'color' ? v.color : null,
          stones: _field === 'stones' ? v.stones : null,
        }
        return cleaned
      })
    )
  }

  function addRow() {
    const defaultField = isDecorative ? 'material' : 'size'
    update([
      ...variants,
      {
        size: null,
        material: null,
        color: null,
        stones: null,
        price_modifier: 0,
        stock: isUnique ? 1 : 1,
        _field: defaultField,
      },
    ])
  }

  function removeRow(index: number) {
    update(variants.filter((_, i) => i !== index))
  }

  function updateField(index: number, key: string, value: unknown) {
    const updated = [...variants]
    updated[index] = { ...updated[index], [key]: value }
    update(updated)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Variantes</h2>

      {variants.length > 0 && (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="text-left px-3 py-2 w-28">Tipo</th>
                <th className="text-left px-3 py-2">Valor</th>
                <th className="text-right px-3 py-2 w-24">Stock</th>
                <th className="text-right px-3 py-2 w-32">Modificador</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {variants.map((variant, i) => (
                <tr key={variant.id ?? `new-${i}`} className="border-t group">
                  <td className="px-3 py-1.5">
                    <select
                      value={variant._field ?? 'size'}
                      onChange={e => updateField(i, '_field', e.target.value)}
                      className="w-full rounded border border-input bg-transparent px-1.5 py-1 text-sm"
                    >
                      {availableTypes.map(t => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={
                        (variant._field && variant[variant._field]) ?? ''
                      }
                      onChange={e =>
                        updateField(i, variant._field ?? 'size', e.target.value || null)
                      }
                      placeholder="ej: Plata 925"
                      className="h-7"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={variant.stock}
                      onChange={e =>
                        updateField(i, 'stock', parseInt(e.target.value) || 0)
                      }
                      disabled={isUnique}
                      className="h-7 text-right"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500 text-xs">
                        {(variant.price_modifier ?? 0) >= 0 ? '+' : ''}
                      </span>
                      <Input
                        type="number"
                        value={variant.price_modifier}
                        onChange={e =>
                          updateField(
                            i,
                            'price_modifier',
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="h-7 text-right"
                      />
                    </div>
                  </td>
                  <td className="px-1.5 py-1.5">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-opacity p-1"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        onClick={addRow}
        className="text-zinc-900 font-medium"
      >
        <Plus className="size-4 mr-1" />
        Agregar variante
      </Button>
    </div>
  )
}
