import { notFound } from 'next/navigation'
import { getDraftPiece } from '@/lib/actions/piece-actions'
import { PieceWizard } from '@/components/artisan/piece-wizard'
import type { MediaFormData, VariantFormData } from '@/types/catalog.types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarPiezaPage({ params }: Props) {
  const { id } = await params
  const product = await getDraftPiece(id)

  if (!product) notFound()

  const initialData = {
    id: product.id,
    title: product.title,
    description: product.description,
    base_price: product.base_price,
    type: product.type,
    status: product.status,
    category_id: product.category_id,
    product_variant: (product.product_variant ?? []).map(v => ({
      id: v.id,
      size: v.size,
      material: v.material,
      color: v.color,
      stones: v.stones,
      price_modifier: v.price_modifier,
      stock: v.stock,
    })) as VariantFormData[],
    product_media: (product.product_media ?? []).map(m => ({
      id: m.id,
      url: m.url,
      cloudinary_id: m.cloudinary_id ?? '',
      sort_order: m.sort_order,
      is_cover: m.is_cover,
    })) as MediaFormData[],
  }

  return (
    <main className="p-8">
      <PieceWizard initialData={initialData} productId={id} />
    </main>
  )
}
