import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getArtisanBySlug, getArtisanProducts } from '@/lib/queries/artisan-queries'
import { generateArtisanMetadata } from '@/lib/seo/metadata'
import { generateArtisanSchema } from '@/lib/seo/schema'
import { ArtisanProfileHeader } from '@/components/artisan/artisan-profile-header'
import { ProductGrid } from '@/components/catalog/product-grid'

interface PageProps {
  params: Promise<{ slug: string; locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const artisan = await getArtisanBySlug(slug)
  if (!artisan) return { title: 'No encontrado | Crisol' }
  return generateArtisanMetadata(artisan)
}

export default async function ArtisanProfilePage({ params }: PageProps) {
  const { slug } = await params
  const artisan = await getArtisanBySlug(slug)
  if (!artisan) notFound()

  const products = await getArtisanProducts(artisan.id)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://crisol.cl'
  const jsonLd = generateArtisanSchema(artisan, siteUrl)
  const name = artisan.user.full_name ?? 'Artesano'

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ArtisanProfileHeader artisan={artisan} />

      {/* Pieces section */}
      <section className="mt-10">
        <h2 className="text-2xl font-semibold text-zinc-900 mb-6">
          Piezas de {name}
        </h2>

        {products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
            <p className="text-base text-zinc-700">
              Este artesano aun no tiene piezas publicadas
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Vuelve pronto para descubrir su trabajo.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
