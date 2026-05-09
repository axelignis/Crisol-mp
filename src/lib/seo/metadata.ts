import type { Metadata } from 'next'
import type { ProductWithDetails, ArtisanProfile } from '@/types/catalog.types'

export function generateProductMetadata(product: ProductWithDetails): Metadata {
  const coverMedia = product.media.find(m => m.is_cover) ?? product.media[0]
  const artisanName = product.artisan.user.full_name ?? 'Artesano'
  const description = product.description?.slice(0, 155)
    ?? `${product.title} por ${artisanName}`
  return {
    title: `${product.title} por ${artisanName} | Crisol`,
    description,
    openGraph: {
      title: `${product.title} por ${artisanName} | Crisol`,
      description,
      images: coverMedia ? [{ url: coverMedia.url }] : [],
    },
  }
}

export function generateArtisanMetadata(artisan: ArtisanProfile): Metadata {
  const name = artisan.user.full_name ?? 'Artesano'
  const description = artisan.bio?.slice(0, 155)
    ?? `${name} - Artesano en Crisol`
  return {
    title: `${name} - Artesano | Crisol`,
    description,
    openGraph: {
      title: `${name} - Artesano | Crisol`,
      description,
      images: artisan.photo_url ? [{ url: artisan.photo_url }] : [],
    },
  }
}
