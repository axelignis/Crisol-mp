import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { MAX_PHOTOS_PER_PRODUCT } from '@/lib/utils/constants'

// Replicate Zod schemas from piece-actions.ts for unit testing
// (server actions use 'use server' and require Supabase client)

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

const variantsArraySchema = z.array(variantSchema)
const mediaArraySchema = z.array(mediaSchema).max(MAX_PHOTOS_PER_PRODUCT)

describe('pieceStep1Schema', () => {
  const validData = {
    type: 'jewelry_unique' as const,
    title: 'Anillo plata 925',
    description: 'Pieza artesanal unica',
    base_price: 50000,
    category_id: null,
  }

  it('accepts valid piece data', () => {
    const result = pieceStep1Schema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('accepts data with UUID category_id', () => {
    const result = pieceStep1Schema.safeParse({
      ...validData,
      category_id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('defaults description to empty string', () => {
    const { description, ...withoutDesc } = validData
    const result = pieceStep1Schema.parse(withoutDesc)
    expect(result.description).toBe('')
  })

  it('rejects title shorter than 3 chars', () => {
    const result = pieceStep1Schema.safeParse({ ...validData, title: 'AB' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('title')
    }
  })

  it('rejects title longer than 200 chars', () => {
    const result = pieceStep1Schema.safeParse({
      ...validData,
      title: 'A'.repeat(201),
    })
    expect(result.success).toBe(false)
  })

  it('rejects base_price < 0', () => {
    const result = pieceStep1Schema.safeParse({ ...validData, base_price: -1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('base_price')
    }
  })

  it('accepts base_price = 0', () => {
    const result = pieceStep1Schema.safeParse({ ...validData, base_price: 0 })
    expect(result.success).toBe(true)
  })

  it('rejects invalid type enum', () => {
    const result = pieceStep1Schema.safeParse({ ...validData, type: 'invalid_type' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('type')
    }
  })

  it('rejects non-integer base_price', () => {
    const result = pieceStep1Schema.safeParse({ ...validData, base_price: 99.5 })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID category_id', () => {
    const result = pieceStep1Schema.safeParse({ ...validData, category_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('variantSchema', () => {
  const validVariant = {
    size: 'M',
    material: 'Plata 925',
    color: null,
    stones: null,
    price_modifier: 0,
    stock: 5,
  }

  it('accepts valid variant data', () => {
    const result = variantsArraySchema.safeParse([validVariant])
    expect(result.success).toBe(true)
  })

  it('accepts variant with UUID id', () => {
    const result = variantSchema.safeParse({
      ...validVariant,
      id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects stock < 0', () => {
    const result = variantSchema.safeParse({ ...validVariant, stock: -1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('stock')
    }
  })

  it('accepts stock = 0', () => {
    const result = variantSchema.safeParse({ ...validVariant, stock: 0 })
    expect(result.success).toBe(true)
  })

  it('rejects non-integer price_modifier', () => {
    const result = variantSchema.safeParse({ ...validVariant, price_modifier: 1.5 })
    expect(result.success).toBe(false)
  })

  it('accepts negative price_modifier (discount)', () => {
    const result = variantSchema.safeParse({ ...validVariant, price_modifier: -5000 })
    expect(result.success).toBe(true)
  })

  it('accepts empty variants array', () => {
    const result = variantsArraySchema.safeParse([])
    expect(result.success).toBe(true)
  })
})

describe('mediaSchema', () => {
  const validMedia = {
    url: 'https://res.cloudinary.com/crisol/image/upload/v1/products/anillo.webp',
    cloudinary_id: 'products/anillo',
    sort_order: 0,
    is_cover: true,
  }

  it('accepts valid media data', () => {
    const result = mediaArraySchema.safeParse([validMedia])
    expect(result.success).toBe(true)
  })

  it('rejects invalid URL', () => {
    const result = mediaSchema.safeParse({ ...validMedia, url: 'not-a-url' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('url')
    }
  })

  it(`rejects more than ${MAX_PHOTOS_PER_PRODUCT} media entries`, () => {
    const tooMany = Array.from({ length: MAX_PHOTOS_PER_PRODUCT + 1 }, (_, i) => ({
      ...validMedia,
      sort_order: i,
    }))
    const result = mediaArraySchema.safeParse(tooMany)
    expect(result.success).toBe(false)
  })

  it(`accepts exactly ${MAX_PHOTOS_PER_PRODUCT} media entries`, () => {
    const exact = Array.from({ length: MAX_PHOTOS_PER_PRODUCT }, (_, i) => ({
      ...validMedia,
      sort_order: i,
    }))
    const result = mediaArraySchema.safeParse(exact)
    expect(result.success).toBe(true)
  })

  it('rejects missing cloudinary_id', () => {
    const { cloudinary_id, ...withoutId } = validMedia
    const result = mediaSchema.safeParse(withoutId)
    expect(result.success).toBe(false)
  })

  it('rejects non-integer sort_order', () => {
    const result = mediaSchema.safeParse({ ...validMedia, sort_order: 1.5 })
    expect(result.success).toBe(false)
  })

  it('accepts media with optional UUID id', () => {
    const result = mediaSchema.safeParse({
      ...validMedia,
      id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })
})
