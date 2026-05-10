// Phase 3 - Stock check endpoint (Plan 03-02)
// D-06 checkpoint 1: valida stock al agregar al carrito.
// Threat: T-03-05 (DoS) → Zod limita 50 items; T-03-06 → qty positiva integer.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { StockCheckResponse, StockCheckResultItem } from '@/types/cart'

const schema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        qty: z.number().int().positive(),
      })
    )
    .min(1)
    .max(50),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', issues: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { items } = parsed.data
  const variantIds = items.map((i) => i.variantId)
  const supabase = await createClient()

  const { data: variants, error } = await supabase
    .from('product_variant')
    .select('id, stock')
    .in('id', variantIds)

  if (error) {
    console.error('[stock-check] supabase error:', error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  const stockById = new Map<string, number>(
    (variants ?? []).map((v) => [v.id as string, (v.stock ?? 0) as number])
  )

  const results: StockCheckResultItem[] = items.map((it) => {
    const available = stockById.get(it.variantId) ?? 0
    return {
      variantId: it.variantId,
      available,
      requested: it.qty,
      sufficient: available >= it.qty,
    }
  })

  const insufficient = results.filter((r) => !r.sufficient)
  const response: StockCheckResponse = insufficient.length
    ? { ok: false, insufficient }
    : { ok: true, items: results }

  return NextResponse.json(response, { status: 200 })
}
