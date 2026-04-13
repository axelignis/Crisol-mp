import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { getPublishedProducts, getFilterOptions } from '@/lib/queries/product-queries'
import { ProductGrid } from '@/components/catalog/product-grid'
import { ProductFilters } from '@/components/catalog/product-filters'
import { SortDropdown } from '@/components/catalog/sort-dropdown'
import { CatalogPagination } from '@/components/catalog/catalog-pagination'
import type { CatalogFilters } from '@/types/catalog.types'

const VALID_ORDERS = ['reciente', 'precio_asc', 'precio_desc'] as const

interface CatalogoPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('catalog')
  return {
    title: `${t('title')} | Crisol`,
    description: t('description'),
  }
}

export default async function CatalogoPage({ searchParams }: CatalogoPageProps) {
  const params = await searchParams
  const t = await getTranslations('catalog')

  // Parse searchParams into CatalogFilters with safe defaults (T-02-13 mitigation)
  const rawTipo = typeof params.tipo === 'string' ? params.tipo : ''
  const rawMaterial = typeof params.material === 'string' ? params.material : ''
  const rawOcasion = typeof params.ocasion === 'string' ? params.ocasion : ''
  const rawTecnica = typeof params.tecnica === 'string' ? params.tecnica : ''
  const rawOrden = typeof params.orden === 'string' ? params.orden : ''
  const rawPagina = typeof params.pagina === 'string' ? params.pagina : '1'
  const rawPrecioMin = typeof params.precio_min === 'string' ? params.precio_min : ''
  const rawPrecioMax = typeof params.precio_max === 'string' ? params.precio_max : ''

  const filters: CatalogFilters = {
    tipo: rawTipo ? rawTipo.split(',').filter(Boolean) : undefined,
    material: rawMaterial ? rawMaterial.split(',').filter(Boolean) : undefined,
    precio_min: rawPrecioMin ? parseInt(rawPrecioMin, 10) : undefined,
    precio_max: rawPrecioMax ? parseInt(rawPrecioMax, 10) : undefined,
    ocasion: rawOcasion ? rawOcasion.split(',').filter(Boolean) : undefined,
    tecnica: rawTecnica ? rawTecnica.split(',').filter(Boolean) : undefined,
    pagina: Math.max(1, parseInt(rawPagina, 10) || 1),
    orden: (VALID_ORDERS.includes(rawOrden as CatalogFilters['orden'])
      ? rawOrden
      : 'reciente') as CatalogFilters['orden'],
  }

  // Sanitize numeric params (T-02-13, T-02-15)
  if (filters.precio_min !== undefined && isNaN(filters.precio_min)) {
    filters.precio_min = undefined
  }
  if (filters.precio_max !== undefined && isNaN(filters.precio_max)) {
    filters.precio_max = undefined
  }

  const [{ products, total }, filterOptions] = await Promise.all([
    getPublishedProducts(filters),
    getFilterOptions(),
  ])

  const totalPages = Math.ceil(total / 24)

  const hasActiveFilters = !!(
    filters.tipo?.length ||
    filters.material?.length ||
    filters.ocasion?.length ||
    filters.tecnica?.length ||
    filters.precio_min !== undefined ||
    filters.precio_max !== undefined
  )

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="flex gap-8">
        {/* Filter sidebar (desktop) + mobile trigger */}
        <ProductFilters filterOptions={filterOptions} currentFilters={filters} />

        {/* Main content area */}
        <div className="flex-1">
          {/* Toolbar: count + sort + mobile filter trigger */}
          <div className="mb-6 flex items-center justify-between">
            <span className="text-sm text-zinc-500">
              {total} {total === 1 ? 'pieza' : 'piezas'}
            </span>
            <SortDropdown currentOrder={filters.orden} />
          </div>

          {/* Product grid or empty state */}
          {products.length === 0 && hasActiveFilters ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <h3 className="text-lg font-semibold text-zinc-900">
                {t('emptyFiltered.title')}
              </h3>
              <p className="mt-2 text-sm text-zinc-500">
                {t('emptyFiltered.description')}
              </p>
              <Link
                href="/catalogo"
                className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {t('emptyFiltered.action')}
              </Link>
            </div>
          ) : (
            <ProductGrid
              products={products}
              emptyTitle={t('empty.title')}
              emptyDescription={t('empty.description')}
            />
          )}

          {/* Pagination */}
          <CatalogPagination currentPage={filters.pagina} totalPages={totalPages} />
        </div>
      </div>
    </main>
  )
}
