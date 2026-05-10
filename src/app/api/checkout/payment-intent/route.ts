// Phase 3 Plan 04 — POST /api/checkout/payment-intent
// Stage cart server-side, reserve coupon (atomic), create Stripe PI.
// Returns clientSecret + canonical totals + snapshotId.
//
// Threat mitigations:
// - T-03-10: cliente nunca calcula totales (server recomputa todo desde DB).
// - T-03-11: buyer logged sin email_confirmed → 403.
// - T-03-12: response NO expone commission al buyer.
// - T-03-14: variantes no published / stock=0 → 409.
// - T-03-15: acceptedDisclaimers literal(true) → audit en cart_snapshot.payload.
// - T-03-23: coupon race fix vía reserveCoupon (UPDATE condicional atómico).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { computeTotals, type ProductLookup } from '@/lib/checkout/totals'
import { reserveCoupon } from '@/lib/checkout/coupon'
import { stageCart } from '@/lib/checkout/stage-cart'
import { buildPayoutLedger } from '@/lib/stripe/payout-ledger'

const checkoutSchema = z.object({
  email: z.string().email(),
  buyer_id: z.string().uuid().nullable(),
  items: z
    .array(z.object({ variantId: z.string().uuid(), qty: z.number().int().positive() }))
    .min(1)
    .max(50),
  address: z.object({
    fullName: z.string().min(2),
    line1: z.string().min(3),
    line2: z.string().optional(),
    city: z.string().min(1),
    region: z.string().min(1),
    countryCode: z.literal('CL'),
    postalCode: z.string().optional(),
    phone: z.string().optional(),
  }),
  shipments: z
    .array(
      z.object({
        artisanId: z.string().uuid(),
        courier: z.enum(['chilexpress', 'starken', 'flat_rate']),
        costClp: z.number().int().nonnegative(),
      })
    )
    .min(1)
    .max(20),
  couponCode: z.string().trim().min(1).max(64).optional(),
  acceptedDisclaimers: z.literal(true),
})

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const input = parsed.data
  const supabase = await createClient()

  try {
    // 1. Si buyer_id present, verificar email_confirmed (D-05, T-03-11)
    if (input.buyer_id) {
      const { data: userRes } = await supabase.auth.getUser()
      if (!userRes?.user || userRes.user.id !== input.buyer_id) {
        return NextResponse.json({ error: 'auth_mismatch' }, { status: 403 })
      }
      if (!userRes.user.email_confirmed_at) {
        return NextResponse.json({ error: 'email_not_confirmed' }, { status: 403 })
      }
    }

    // 2. Lookup canonical de variants + product (joined)
    const variantIds = input.items.map((i) => i.variantId)
    const { data: variantsData, error: vErr } = await supabase
      .from('product_variant')
      .select('id, product_id, price_modifier, stock, product:product(id, artisan_id, base_price, status, title, slug)')
      .in('id', variantIds)
    if (vErr) {
      console.error('[payment-intent] variant query error:', vErr)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }

    type VariantRow = {
      id: string
      product_id: string
      price_modifier: number | null
      stock: number | null
      product: { id: string; artisan_id: string; base_price: number; status: string; title: string; slug: string } | null
    }
    const variants = (variantsData ?? []) as unknown as VariantRow[]

    // Validar todos los variants existen y product publicado
    const insufficient: Array<{ variantId: string; available: number; requested: number }> = []
    const lookup: ProductLookup = {}
    for (const it of input.items) {
      const v = variants.find((x) => x.id === it.variantId)
      if (!v || !v.product || v.product.status !== 'published') {
        insufficient.push({ variantId: it.variantId, available: 0, requested: it.qty })
        continue
      }
      const stock = v.stock ?? 0
      if (stock < it.qty) {
        insufficient.push({ variantId: it.variantId, available: stock, requested: it.qty })
        continue
      }
      lookup[it.variantId] = {
        variantId: v.id,
        productId: v.product.id,
        artisanId: v.product.artisan_id,
        basePrice: v.product.base_price,
        priceModifier: v.price_modifier ?? 0,
        snapshotTitle: v.product.title,
      }
    }
    if (insufficient.length > 0) {
      return NextResponse.json({ error: 'stock_insufficient', insufficient }, { status: 409 })
    }

    // 3. Comisión vigente
    const { data: commRow } = await supabase
      .from('commission_config')
      .select('commission_pct')
      .lte('effective_from', new Date().toISOString())
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle()
    const commissionPct = Number(commRow?.commission_pct ?? 10)

    // 4. Validar shipments cubren artesanos
    const artisanIds = Array.from(new Set(Object.values(lookup).map((p) => p.artisanId)))
    const shippedArtisans = new Set(input.shipments.map((s) => s.artisanId))
    for (const aid of artisanIds) {
      if (!shippedArtisans.has(aid)) {
        return NextResponse.json({ error: 'shipment_missing', artisanId: aid }, { status: 400 })
      }
    }

    // 5. Calcular subtotal preliminar para reserveCoupon
    let preSubtotal = 0
    for (const it of input.items) {
      const p = lookup[it.variantId]
      preSubtotal += (p.basePrice + p.priceModifier) * it.qty
    }

    // 6. Reservar cupón (atomic) si presente
    let reservedDiscount = 0
    let couponId: string | null = null
    if (input.couponCode) {
      const r = await reserveCoupon(input.couponCode, preSubtotal, supabase)
      if (!r.valid) {
        return NextResponse.json({ error: 'coupon_invalid', reason: r.reason }, { status: 409 })
      }
      reservedDiscount = r.discount
      couponId = r.couponId
    }

    // 7. computeTotals
    const totals = computeTotals({
      items: input.items,
      shipments: input.shipments,
      productLookup: lookup,
      commissionPct,
      reservedDiscount,
    })

    // 8. Build payout ledger (consumido por webhook Plan 05)
    const ledger = buildPayoutLedger({
      perArtisan: totals.perArtisan,
      discount: totals.discount,
      subtotal: totals.subtotal,
      shippingTotal: totals.shippingTotal,
    })

    // 9. Stage cart (con couponId + ledger + commissionPct para webhook Plan 05)
    const snapshotId = await stageCart(
      supabase,
      input,
      { ...totals, couponId, ledger, commissionPct } as never,
    )

    // 10. Create Stripe PI (idempotency = snapshotId)
    const pi = await stripe.paymentIntents.create(
      {
        amount: totals.total,
        currency: 'clp',
        automatic_payment_methods: { enabled: true },
        metadata: {
          cart_snapshot_id: snapshotId,
          buyer_id: input.buyer_id ?? '',
        },
        receipt_email: input.email,
      },
      { idempotencyKey: `pi:${snapshotId}` }
    )

    // 11. Response — NO incluir commission (T-03-12)
    return NextResponse.json({
      clientSecret: pi.client_secret,
      snapshotId,
      totals: {
        subtotal: totals.subtotal,
        discount: totals.discount,
        shippingTotal: totals.shippingTotal,
        total: totals.total,
        perArtisan: totals.perArtisan.map((p) => ({
          artisanId: p.artisanId,
          subtotal: p.subtotal,
          shipping: p.shipping,
        })),
      },
    })
  } catch (e) {
    console.error('[payment-intent] unexpected:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
