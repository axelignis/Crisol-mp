import { createClient } from '@/lib/supabase/server'
import type { ArtisanProfile, ProductCardData } from '@/types/catalog.types'

export async function getArtisanBySlug(slug: string): Promise<ArtisanProfile | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('artisan')
    .select(`
      id, slug, bio, photo_url, instagram, website,
      user:user_id (full_name)
    `)
    .eq('slug', slug)
    .eq('is_suspended', false)
    .single()

  if (error || !data) return null
  return data as unknown as ArtisanProfile
}

export async function getArtisanProducts(artisanId: string): Promise<ProductCardData[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('product')
    .select(`
      id, title, slug, base_price, type, status,
      artisan:artisan_id (id, slug, user:user_id (full_name)),
      media:product_media!inner (url, is_cover)
    `)
    .eq('artisan_id', artisanId)
    .in('status', ['published', 'sold'])
    .eq('product_media.is_cover', true)
    .order('published_at', { ascending: false, nullsFirst: false })

  if (error) throw error
  return (data ?? []).map((p: any) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    base_price: p.base_price,
    type: p.type,
    status: p.status,
    artisan: p.artisan,
    cover_url: p.media?.[0]?.url ?? null,
  }))
}
