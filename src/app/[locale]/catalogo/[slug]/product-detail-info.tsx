'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { formatCLP, getVariantPrice } from '@/lib/utils/format'
import { VariantSelector } from '@/components/catalog/variant-selector'
import { Badge } from '@/components/ui/badge'
import { useCart } from '@/hooks/use-cart'
import type { ProductWithDetails } from '@/types/catalog.types'
import type { Database } from '@/types/database.types'
import type { StockCheckResponse } from '@/types/cart'

type ProductVariantRow = Database['public']['Tables']['product_variant']['Row']

interface ProductDetailInfoProps {
  product: ProductWithDetails
  locale: string
}

export function ProductDetailInfo({ product, locale }: ProductDetailInfoProps) {
  const t = useTranslations('cart')
  const [displayPrice, setDisplayPrice] = useState(product.base_price)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantRow | null>(
    product.variants[0] ?? null
  )
  const [isPending, startTransition] = useTransition()
  const { add } = useCart()

  const isSold = product.status === 'sold'
  const artisanName = product.artisan.user.full_name ?? 'Artesano'
  const coverUrl = product.media[0]?.url ?? undefined
  const canAddToCart = !isSold && selectedVariant != null && !isPending

  async function handleAddToCart() {
    if (!selectedVariant) return
    startTransition(async () => {
      try {
        const res = await fetch('/api/cart/stock-check', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            items: [{ variantId: selectedVariant.id, qty: 1 }],
          }),
        })
        const json = (await res.json()) as StockCheckResponse
        if (!res.ok || ('ok' in json && json.ok === false)) {
          const insufficient = 'insufficient' in json ? json.insufficient : []
          const first = insufficient[0]
          if (first) {
            if (first.available <= 0) {
              toast.error(t('stockOut'))
            } else {
              toast.error(t('stockError', { available: first.available }))
            }
          } else {
            toast.error(t('genericError'))
          }
          return
        }
        const unitPrice = getVariantPrice(
          product.base_price,
          selectedVariant.price_modifier ?? 0
        )
        add({
          productId: product.id,
          variantId: selectedVariant.id,
          artisanId: product.artisan.id,
          artisanName,
          title: product.title,
          unitPrice,
          qty: 1,
          imageUrl: coverUrl,
        })
        toast.success(t('addedToast'))
      } catch (err) {
        console.error('[add-to-cart]', err)
        toast.error(t('genericError'))
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-zinc-900">{product.title}</h1>

      {product.artisan.slug && (
        <Link
          href={`/${locale}/artesanos/${product.artisan.slug}`}
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          {artisanName}
        </Link>
      )}

      <div className="flex items-center gap-3">
        <span className="text-xl font-semibold text-zinc-900">
          {formatCLP(displayPrice)}
        </span>
        {isSold && <Badge className="bg-zinc-700 text-white">Vendida</Badge>}
      </div>

      {product.variants.length > 0 && !isSold && (
        <VariantSelector
          variants={product.variants}
          basePrice={product.base_price}
          onPriceChange={(price) => {
            setDisplayPrice(price)
            const found = product.variants.find(
              (v) => getVariantPrice(product.base_price, v.price_modifier ?? 0) === price
            )
            if (found) setSelectedVariant(found)
          }}
        />
      )}

      <button
        type="button"
        onClick={handleAddToCart}
        disabled={!canAddToCart}
        className="mt-4 min-h-[44px] w-full rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="add-to-cart-button"
        data-product-id={product.id}
        data-variant-id={selectedVariant?.id ?? ''}
      >
        {isSold ? 'Vendida' : isPending ? '...' : 'Agregar al carrito'}
      </button>
    </div>
  )
}
