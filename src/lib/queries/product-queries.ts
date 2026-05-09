import { createClient } from '@/lib/supabase/server'
import type { CatalogFilters, ProductCardData, ProductWithDetails, FilterOptions, FilterOption } from '@/types/catalog.types'

const ITEMS_PER_PAGE = 24

export async function getPublishedProducts(filters: CatalogFilters): Promise<{ products: ProductCardData[]; total: number }> {
  const supabase = await createClient()
  const offset = (filters.pagina - 1) * ITEMS_PER_PAGE

  // Step 1: If tag-based filters are active (material, ocasion, tecnica),
  // first query product_tag + tag to get matching product IDs, then filter main query.
  // This implements OR-within-type AND between-types (DISC-02).
  let tagFilteredIds: string[] | null = null
  const tagFilters: { type: string; slugs: string[] }[] = []
  if (filters.material?.length) tagFilters.push({ type: 'material', slugs: filters.material })
  if (filters.ocasion?.length) tagFilters.push({ type: 'occasion', slugs: filters.ocasion })
  if (filters.tecnica?.length) tagFilters.push({ type: 'technique', slugs: filters.tecnica })

  if (tagFilters.length > 0) {
    // For each tag type, get product IDs that match ANY slug (OR within type).
    // Then intersect across types (AND between types).
    const idSets: Set<string>[] = []
    for (const tf of tagFilters) {
      const { data: tagMatches } = await supabase
        .from('product_tag')
        .select('product_id, tag:tag_id!inner (slug, type)')
        .in('tag.slug', tf.slugs)
        .eq('tag.type', tf.type)
      const ids = new Set((tagMatches ?? []).map((m: any) => m.product_id))
      idSets.push(ids)
    }
    // Intersect all sets
    const intersection = idSets.reduce((acc, set) => {
      return new Set([...acc].filter(id => set.has(id)))
    })
    tagFilteredIds = [...intersection]
    // If intersection is empty, no products match -- return early
    if (tagFilteredIds.length === 0) {
      return { products: [], total: 0 }
    }
  }

  let query = supabase
    .from('product')
    .select(`
      id, title, slug, base_price, type, status,
      artisan:artisan_id (id, slug, user:user_id (full_name)),
      media:product_media!inner (url, is_cover)
    `, { count: 'exact' })
    .in('status', ['published', 'sold'])
    .eq('product_media.is_cover', true)
    .range(offset, offset + ITEMS_PER_PAGE - 1)

  // Apply tag-filter intersection (product IDs from tag subquery)
  if (tagFilteredIds !== null) {
    query = query.in('id', tagFilteredIds)
  }

  // Apply tipo filter (OR within)
  if (filters.tipo?.length) {
    query = query.in('type', filters.tipo)
  }
  // Apply price range
  if (filters.precio_min !== undefined) {
    query = query.gte('base_price', filters.precio_min)
  }
  if (filters.precio_max !== undefined) {
    query = query.lte('base_price', filters.precio_max)
  }

  // Sort
  switch (filters.orden) {
    case 'precio_asc':
      query = query.order('base_price', { ascending: true })
      break
    case 'precio_desc':
      query = query.order('base_price', { ascending: false })
      break
    default: // 'reciente'
      query = query.order('published_at', { ascending: false, nullsFirst: false })
  }

  const { data, count, error } = await query
  if (error) throw error

  const products: ProductCardData[] = (data ?? []).map((p: any) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    base_price: p.base_price,
    type: p.type,
    status: p.status,
    artisan: p.artisan,
    cover_url: p.media?.[0]?.url ?? null,
  }))

  return { products, total: count ?? 0 }
}

export async function getProductBySlug(slug: string): Promise<ProductWithDetails | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('product')
    .select(`
      id, title, slug, description, base_price, type, status, is_unique,
      rejection_notes, published_at, created_at,
      artisan:artisan_id (id, slug, bio, photo_url, user:user_id (full_name)),
      category:category_id (id, name, slug),
      variants:product_variant (id, size, material, color, stones, price_modifier, stock, is_available),
      media:product_media (id, url, cloudinary_id, sort_order, is_cover, type),
      tags:product_tag (tag:tag_id (id, name, slug, type))
    `)
    .eq('slug', slug)
    .in('status', ['published', 'sold'])
    .single()

  if (error || !data) return null
  return data as unknown as ProductWithDetails
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const supabase = await createClient()
  const { data: tags } = await supabase
    .from('tag')
    .select('id, name, slug, type')
    .order('name')

  const { data: priceRange } = await supabase
    .from('product')
    .select('base_price')
    .in('status', ['published', 'sold'])
    .order('base_price', { ascending: true })
    .limit(1)
    .single()

  const { data: priceMax } = await supabase
    .from('product')
    .select('base_price')
    .in('status', ['published', 'sold'])
    .order('base_price', { ascending: false })
    .limit(1)
    .single()

  const grouped = (tags ?? []).reduce((acc: Record<string, FilterOption[]>, tag: any) => {
    const key = tag.type
    if (!acc[key]) acc[key] = []
    acc[key].push({ slug: tag.slug, name: tag.name, count: 0 })
    return acc
  }, {} as Record<string, FilterOption[]>)

  return {
    tipos: [
      { slug: 'jewelry_unique', name: 'Pieza unica', count: 0 },
      { slug: 'jewelry_series', name: 'Serie', count: 0 },
      { slug: 'decorative', name: 'Arte decorativo', count: 0 },
    ],
    materiales: grouped['material'] ?? [],
    ocasiones: grouped['occasion'] ?? [],
    tecnicas: grouped['technique'] ?? [],
    precio_min: priceRange?.base_price ?? 0,
    precio_max: priceMax?.base_price ?? 1000000,
  }
}

export async function getPendingProducts() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('product')
    .select(`
      id, title, slug, description, base_price, type, status, created_at,
      artisan:artisan_id (id, slug, user:user_id (full_name)),
      variants:product_variant (id, size, material, color, stones, price_modifier, stock),
      media:product_media (id, url, sort_order, is_cover, type)
    `)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}
