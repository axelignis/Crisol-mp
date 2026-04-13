import { ProductCard } from '@/components/catalog/product-card'
import type { ProductCardData } from '@/types/catalog.types'

interface ProductGridProps {
  products: ProductCardData[]
  emptyTitle?: string
  emptyDescription?: string
}

export function ProductGrid({ products, emptyTitle, emptyDescription }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h3 className="text-lg font-semibold text-zinc-900">
          {emptyTitle ?? 'No hay piezas disponibles'}
        </h3>
        <p className="mt-2 text-sm text-zinc-500">
          {emptyDescription ?? 'Vuelve pronto, nuestros artesanos estan creando nuevas obras.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
