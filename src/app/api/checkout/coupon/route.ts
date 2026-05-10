// Phase 3 Plan 04 — POST /api/checkout/coupon
// Read-only preview: NO incrementa uses_count. Solo muestra el descuento al UI.
// La reserva atómica se hace en /api/checkout/payment-intent (D-15 race fix).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { validateCoupon } from '@/lib/checkout/coupon'

const schema = z.object({
  code: z.string().trim().min(1).max(64),
  subtotal: z.number().int().nonnegative(),
})

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const r = await validateCoupon(parsed.data.code, parsed.data.subtotal, supabase)
  if (!r.valid) {
    // Mensaje genérico del lado UI; NO exponer detalle de existencia (T-03-13 brute force)
    return NextResponse.json({ valid: false, reason: r.reason })
  }
  return NextResponse.json({
    valid: true,
    discount: r.discount,
    discountType: r.discountType,
  })
}
