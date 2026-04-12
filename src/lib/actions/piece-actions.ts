'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils/slugify'
import { MAX_PHOTOS_PER_PRODUCT } from '@/lib/utils/constants'
import type { PieceStep1Data, VariantFormData, MediaFormData } from '@/types/catalog.types'

// --- Zod Schemas ---

const pieceStep1Schema = z.object({
  type: z.enum(['jewelry_unique', 'jewelry_series', 'decorative']),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional().default(''),
  base_price: z.number().int().min(0),
  category_id: z.string().uuid().nullable(),
})

const variantSchema = z.object({
  id: z.string().uuid().optional(),
  size: z.string().nullable(),
  material: z.string().nullable(),
  color: z.string().nullable(),
  stones: z.string().nullable(),
  price_modifier: z.number().int(),
  stock: z.number().int().min(0),
})

const mediaSchema = z.object({
  id: z.string().uuid().optional(),
  url: z.string().url(),
  cloudinary_id: z.string(),
  sort_order: z.number().int(),
  is_cover: z.boolean(),
})

// --- Helpers ---

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')
  return { supabase, user }
}

async function getArtisanId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: artisan, error } = await supabase
    .from('artisan')
    .select('id')
    .eq('user_id', userId)
    .single()
  if (error || !artisan) throw new Error('Artisan profile not found')
  return artisan.id
}

// --- Server Actions ---

export async function savePieceDraft(
  productId: string | null,
  data: PieceStep1Data
) {
  const { supabase, user } = await getAuthenticatedUser()
  const validated = pieceStep1Schema.parse(data)
  const artisanId = await getArtisanId(supabase, user.id)

  if (!productId) {
    // Create new draft
    const slug = slugify(validated.title) + '-' + Date.now().toString(36)
    const { data: product, error } = await supabase
      .from('product')
      .insert({
        artisan_id: artisanId,
        category_id: validated.category_id,
        title: validated.title,
        slug,
        description: validated.description,
        base_price: validated.base_price,
        is_unique: validated.type === 'jewelry_unique',
        type: validated.type,
        status: 'draft',
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    return product.id
  }

  // Update existing draft
  const { error } = await supabase
    .from('product')
    .update({
      category_id: validated.category_id,
      title: validated.title,
      description: validated.description,
      base_price: validated.base_price,
      is_unique: validated.type === 'jewelry_unique',
      type: validated.type,
    })
    .eq('id', productId)

  if (error) throw new Error(error.message)
  return productId
}

export async function saveVariants(
  productId: string,
  variants: VariantFormData[]
) {
  const { supabase } = await getAuthenticatedUser()
  const validated = z.array(variantSchema).parse(variants)

  // Get product type to enforce stock=1 for unique pieces
  const { data: product } = await supabase
    .from('product')
    .select('type')
    .eq('id', productId)
    .single()

  const isUnique = product?.type === 'jewelry_unique'

  // Get existing variant ids
  const incomingIds = validated.filter(v => v.id).map(v => v.id!)

  // Delete variants not in incoming set
  if (incomingIds.length > 0) {
    await supabase
      .from('product_variant')
      .delete()
      .eq('product_id', productId)
      .not('id', 'in', `(${incomingIds.join(',')})`)
  } else {
    await supabase
      .from('product_variant')
      .delete()
      .eq('product_id', productId)
  }

  // Upsert each variant
  const results = []
  for (const variant of validated) {
    const stock = isUnique ? 1 : variant.stock
    if (variant.id) {
      const { data, error } = await supabase
        .from('product_variant')
        .update({
          size: variant.size,
          material: variant.material,
          color: variant.color,
          stones: variant.stones,
          price_modifier: variant.price_modifier,
          stock,
        })
        .eq('id', variant.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      results.push(data)
    } else {
      const { data, error } = await supabase
        .from('product_variant')
        .insert({
          product_id: productId,
          size: variant.size,
          material: variant.material,
          color: variant.color,
          stones: variant.stones,
          price_modifier: variant.price_modifier,
          stock,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      results.push(data)
    }
  }

  return results
}

export async function saveMedia(
  productId: string,
  media: MediaFormData[]
) {
  const { supabase } = await getAuthenticatedUser()
  const validated = z.array(mediaSchema).max(MAX_PHOTOS_PER_PRODUCT).parse(media)

  // Ensure exactly one cover
  const hasCover = validated.some(m => m.is_cover)
  if (!hasCover && validated.length > 0) {
    validated[0].is_cover = true
  }

  // Get existing media ids
  const incomingIds = validated.filter(m => m.id).map(m => m.id!)

  // Delete media not in incoming set
  if (incomingIds.length > 0) {
    await supabase
      .from('product_media')
      .delete()
      .eq('product_id', productId)
      .not('id', 'in', `(${incomingIds.join(',')})`)
  } else {
    await supabase
      .from('product_media')
      .delete()
      .eq('product_id', productId)
  }

  // Upsert each media record
  const results = []
  for (const item of validated) {
    if (item.id) {
      const { data, error } = await supabase
        .from('product_media')
        .update({
          url: item.url,
          cloudinary_id: item.cloudinary_id,
          sort_order: item.sort_order,
          is_cover: item.is_cover,
        })
        .eq('id', item.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      results.push(data)
    } else {
      const { data, error } = await supabase
        .from('product_media')
        .insert({
          product_id: productId,
          type: 'photo',
          url: item.url,
          cloudinary_id: item.cloudinary_id,
          sort_order: item.sort_order,
          is_cover: item.is_cover,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      results.push(data)
    }
  }

  return results
}

export async function submitForReview(productId: string) {
  const { supabase, user } = await getAuthenticatedUser()

  // Validate product has title and at least 1 photo
  const { data: product, error: fetchErr } = await supabase
    .from('product')
    .select('title, product_media(id)')
    .eq('id', productId)
    .single()

  if (fetchErr || !product) throw new Error('Product not found')
  if (!product.title) throw new Error('Product must have a title')
  if (!product.product_media || product.product_media.length === 0) {
    throw new Error('Product must have at least 1 photo')
  }

  // Transition via state machine RPC
  const { data, error } = await supabase.rpc('transition_product_status', {
    p_product_id: productId,
    p_new_status: 'pending_review',
    p_actor_id: user.id,
  })

  if (error) throw new Error(error.message)
  return data
}

export async function updatePublishedPiece(
  productId: string,
  data: Partial<PieceStep1Data>
) {
  const { supabase } = await getAuthenticatedUser()

  // Validate partial data
  const partialSchema = pieceStep1Schema.partial()
  const validated = partialSchema.parse(data)

  const updateData: Record<string, unknown> = {}
  if (validated.title !== undefined) updateData.title = validated.title
  if (validated.description !== undefined) updateData.description = validated.description
  if (validated.base_price !== undefined) updateData.base_price = validated.base_price
  if (validated.category_id !== undefined) updateData.category_id = validated.category_id
  if (validated.type !== undefined) {
    updateData.type = validated.type
    updateData.is_unique = validated.type === 'jewelry_unique'
  }

  const { data: product, error } = await supabase
    .from('product')
    .update(updateData)
    .eq('id', productId)
    .select('slug')
    .single()

  if (error) throw new Error(error.message)

  // ISR revalidation
  revalidatePath('/es/catalogo')
  if (product?.slug) {
    revalidatePath(`/es/catalogo/${product.slug}`)
  }

  return product
}

export async function getDraftPiece(productId: string) {
  const { supabase, user } = await getAuthenticatedUser()
  const artisanId = await getArtisanId(supabase, user.id)

  const { data: product, error } = await supabase
    .from('product')
    .select(`
      id, title, slug, description, base_price, type, status,
      is_unique, rejection_notes, category_id, published_at, created_at,
      artisan_id,
      product_variant (
        id, size, material, color, stones, price_modifier, stock, sku, is_available, created_at
      ),
      product_media (
        id, type, url, cloudinary_id, sort_order, is_cover, created_at
      )
    `)
    .eq('id', productId)
    .single()

  if (error || !product) return null
  if (product.artisan_id !== artisanId) return null

  return product
}

export async function getMyPieces() {
  const { supabase, user } = await getAuthenticatedUser()
  const artisanId = await getArtisanId(supabase, user.id)

  const { data: products, error } = await supabase
    .from('product')
    .select(`
      id, title, slug, base_price, type, status, rejection_notes, created_at,
      product_media!inner (url, is_cover)
    `)
    .eq('artisan_id', artisanId)
    .eq('product_media.is_cover', true)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  // Also get products without media (the inner join excludes them)
  const { data: allProducts, error: allErr } = await supabase
    .from('product')
    .select('id, title, slug, base_price, type, status, rejection_notes, created_at')
    .eq('artisan_id', artisanId)
    .order('created_at', { ascending: false })

  if (allErr) throw new Error(allErr.message)

  // Merge: use cover from first query, fallback for products without media
  const coverMap = new Map<string, string>()
  if (products) {
    for (const p of products) {
      const media = p.product_media
      if (Array.isArray(media) && media.length > 0) {
        coverMap.set(p.id, media[0].url)
      }
    }
  }

  return (allProducts ?? []).map(p => ({
    ...p,
    cover_url: coverMap.get(p.id) ?? null,
  }))
}
