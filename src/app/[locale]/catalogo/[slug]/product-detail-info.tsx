'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCLP } from '@/lib/utils/format'
import { VariantSelector } from '@/components/catalog/variant-selector'
import { Badge } from '@/components/ui/badge'
import type { ProductWithDetails } from '@/types/catalog.types'

interface ProductDetailInfoProps {
  product: ProductWithDetails
  locale: string
}

export function ProductDetailInfo({ product, locale }: ProductDetailInfoProps) {
  const [displayPrice, setDisplayPrice] = useState(product.base_price)
  const isSold = product.status === 'sold'

  return (
    <div className="flex flex-col gap-4">
      {/* Title */}
      <h1 className="text-2xl font-semibold text-zinc-900">{product.title}</h1>

      {/* Artisan link */}
      {product.artisan.slug && (
        <Link
          href={`/${locale}/artesanos/${product.artisan.slug}`}
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          {product.artisan.user.full_name ?? 'Artesano'}
        </Link>
      )}

      {/* Price */}
      <div className="flex items-center gap-3">
        <span className="text-xl font-semibold text-zinc-900">
          {formatCLP(displayPrice)}
        </span>
        {isSold && (
          <Badge className="bg-zinc-700 text-white">Vendida</Badge>
        )}
      </div>

      {/* Variant selector */}
      {product.variants.length > 0 && !isSold && (
        <VariantSelector
          variants={product.variants}
          basePrice={product.base_price}
          onPriceChange={setDisplayPrice}
        />
      )}

      {/* Add to cart (Phase 3 placeholder) */}
      <button
        type="button"
        disabled
        title="Disponible pronto"
        className="mt-4 min-h-[44px] w-full rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white opacity-50 cursor-not-allowed"
      >
        Agregar al carrito
      </button>
    </div>
  )
}
