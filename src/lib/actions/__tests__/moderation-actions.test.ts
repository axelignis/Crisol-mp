import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

// --- Zod schemas extracted for unit testing (same as in moderation-actions.ts) ---

const approveSchema = z.object({
  productId: z.string().uuid(),
})

const requestChangesSchema = z.object({
  productId: z.string().uuid(),
  feedback: z.string().min(1, 'Feedback requerido').max(2000),
})

const rejectSchema = z.object({
  productId: z.string().uuid(),
  feedback: z.string().max(2000).nullable(),
})

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('moderation-actions Zod validation', () => {
  describe('approveSchema', () => {
    it('accepts valid UUID productId', () => {
      const result = approveSchema.safeParse({ productId: VALID_UUID })
      expect(result.success).toBe(true)
    })

    it('rejects non-UUID productId', () => {
      const result = approveSchema.safeParse({ productId: 'not-a-uuid' })
      expect(result.success).toBe(false)
    })

    it('rejects missing productId', () => {
      const result = approveSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('requestChangesSchema', () => {
    it('accepts valid productId and feedback', () => {
      const result = requestChangesSchema.safeParse({
        productId: VALID_UUID,
        feedback: 'Please fix the description',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty feedback string', () => {
      const result = requestChangesSchema.safeParse({
        productId: VALID_UUID,
        feedback: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects feedback over 2000 characters', () => {
      const result = requestChangesSchema.safeParse({
        productId: VALID_UUID,
        feedback: 'x'.repeat(2001),
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing feedback', () => {
      const result = requestChangesSchema.safeParse({
        productId: VALID_UUID,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('rejectSchema', () => {
    it('accepts valid productId with feedback', () => {
      const result = rejectSchema.safeParse({
        productId: VALID_UUID,
        feedback: 'Does not meet quality standards',
      })
      expect(result.success).toBe(true)
    })

    it('accepts null feedback', () => {
      const result = rejectSchema.safeParse({
        productId: VALID_UUID,
        feedback: null,
      })
      expect(result.success).toBe(true)
    })

    it('rejects feedback over 2000 characters', () => {
      const result = rejectSchema.safeParse({
        productId: VALID_UUID,
        feedback: 'x'.repeat(2001),
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-UUID productId', () => {
      const result = rejectSchema.safeParse({
        productId: '123',
        feedback: null,
      })
      expect(result.success).toBe(false)
    })
  })
})
