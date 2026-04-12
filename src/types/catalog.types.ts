import type { Database } from './database.types'

// Base row types extracted from generated types
type ProductRow = Database['public']['Tables']['product']['Row']
type ProductVariantRow = Database['public']['Tables']['product_variant']['Row']
type ProductMediaRow = Database['public']['Tables']['product_media']['Row']
type CategoryRow = Database['public']['Tables']['category']['Row']
type TagRow = Database['public']['Tables']['tag']['Row']
type ArtisanRow = Database['public']['Tables']['artisan']['Row']

// Joined types for queries
export interface ProductCardData {
  id: string
  title: string
  slug: string
  base_price: number
  type: ProductRow['type']
  status: ProductRow['status']
  artisan: { id: string; slug: string | null; user: { full_name: string | null } }
  cover_url: string | null
}

export interface ProductWithDetails {
  id: string
  title: string
  slug: string
  description: string | null
  base_price: number
  type: ProductRow['type']
  status: ProductRow['status']
  is_unique: boolean
  rejection_notes: string | null
  published_at: string | null
  created_at: string
  artisan: { id: string; slug: string | null; bio: string | null; photo_url: string | null; user: { full_name: string | null } }
  category: { id: string; name: string; slug: string } | null
  variants: ProductVariantRow[]
  media: ProductMediaRow[]
  tags: { tag: TagRow }[]
}

export interface ArtisanProfile {
  id: string
  slug: string | null
  bio: string | null
  photo_url: string | null
  instagram: string | null
  website: string | null
  user: { full_name: string | null }
}

export interface CatalogFilters {
  tipo?: string[]
  material?: string[]
  precio_min?: number
  precio_max?: number
  ocasion?: string[]
  tecnica?: string[]
  pagina: number
  orden: 'reciente' | 'precio_asc' | 'precio_desc'
}

export interface FilterOption {
  slug: string
  name: string
  count: number
}

export interface FilterOptions {
  tipos: FilterOption[]
  materiales: FilterOption[]
  ocasiones: FilterOption[]
  tecnicas: FilterOption[]
  precio_min: number
  precio_max: number
}

// Form types for wizard
export interface PieceStep1Data {
  type: 'jewelry_unique' | 'jewelry_series' | 'decorative'
  title: string
  description: string
  base_price: number
  category_id: string | null
}

export interface VariantFormData {
  id?: string
  size: string | null
  material: string | null
  color: string | null
  stones: string | null
  price_modifier: number
  stock: number
}

export interface MediaFormData {
  id?: string
  url: string
  cloudinary_id: string
  sort_order: number
  is_cover: boolean
}

export type PieceStatus = ProductRow['status']
export type PieceType = ProductRow['type']
export type TagType = TagRow['type']
