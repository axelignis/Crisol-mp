import Image from 'next/image'
import { Link } from '@/i18n/routing'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PriceDisplay } from '@/components/catalog/price-display'
import type { ProductCardData } from '@/types/catalog.types'

interface ProductCardProps {
  product: ProductCardData
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/catalogo/${product.slug}`} className="group/link block">
      <Card className="relative overflow-hidden p-0 hover:shadow-md transition-shadow">
        {/* Cover photo */}
        <div className="relative aspect-square bg-zinc-100">
          {product.cover_url ? (
            <Image
              src={product.cover_url}
              alt={product.title}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
          )}

          {/* Sold overlay */}
          {product.status === 'sold' && (
            <div className="absolute inset-0 flex items-start justify-end bg-black/50 p-2">
              <Badge className="bg-amber-500 text-white">Vendida</Badge>
            </div>
          )}
        </div>

        {/* Text content */}
        <CardContent className="space-y-1 p-4">
          <h3 className="truncate text-sm font-semibold text-zinc-900">
            {product.title}
          </h3>
          <PriceDisplay amount={product.base_price} />
          <p className="truncate text-sm text-zinc-500">
            {product.artisan.user.full_name}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
