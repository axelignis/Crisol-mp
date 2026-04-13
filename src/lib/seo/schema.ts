import type { ProductWithDetails, ArtisanProfile } from '@/types/catalog.types'

export function generateProductSchema(product: ProductWithDetails) {
  const coverMedia = product.media.find(m => m.is_cover) ?? product.media[0]
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description ?? '',
    image: coverMedia?.url ?? '',
    offers: {
      '@type': 'Offer',
      price: product.base_price,
      priceCurrency: 'CLP',
      availability: product.status === 'sold'
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
    },
    brand: {
      '@type': 'Brand',
      name: product.artisan.user.full_name ?? 'Crisol',
    },
  }
}

export function generateArtisanSchema(artisan: ArtisanProfile, siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: artisan.user.full_name ?? '',
    description: artisan.bio ?? '',
    image: artisan.photo_url ?? '',
    url: `${siteUrl}/es/artesanos/${artisan.slug}`,
  }
}
