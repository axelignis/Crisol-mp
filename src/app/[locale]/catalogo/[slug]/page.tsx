import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getProductBySlug } from '@/lib/queries/product-queries'
import { generateProductMetadata } from '@/lib/seo/metadata'
import { generateProductSchema } from '@/lib/seo/schema'
import { ProductGallery } from '@/components/catalog/product-gallery'
import { ProductDetailInfo } from './product-detail-info'

interface PageProps {
  params: Promise<{ slug: string; locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: 'No encontrado | Crisol' }
  return generateProductMetadata(product)
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug, locale } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const jsonLd = generateProductSchema(product)

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-zinc-500" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1">
          <li>
            <Link href={`/${locale}/catalogo`} className="hover:text-zinc-900">
              Catalogo
            </Link>
          </li>
          {product.category && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href={`/${locale}/catalogo?tipo=${product.category.slug}`}
                  className="hover:text-zinc-900"
                >
                  {product.category.name}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li className="text-zinc-900">{product.title}</li>
        </ol>
      </nav>

      {/* Two-column layout */}
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Gallery - left */}
        <div className="w-full lg:w-1/2">
          <ProductGallery media={product.media} />
        </div>

        {/* Info - right */}
        <div className="w-full lg:w-1/2">
          <ProductDetailInfo product={product} locale={locale} />
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <div className="mt-8">
          <p className="text-base text-zinc-700 leading-relaxed whitespace-pre-line">
            {product.description}
          </p>
        </div>
      )}
    </main>
  )
}
