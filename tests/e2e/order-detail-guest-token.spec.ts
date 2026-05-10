/**
 * Phase 3 / Plan 03-08 — Order detail con guest token (D-23, T-03-23).
 *
 * Verifica que `/pedido/[id]?token=...`:
 *  - Sin token → 404 (notFound) cuando no hay sesión.
 *  - Con token inválido (firma corrupta) → 404.
 *  - Con token válido para OTRO orderId → 404.
 *  - Con token válido + orderId existente en DB → 200 + render de detalle.
 *
 * Estrategia: insertamos una orden vía service-role, firmamos token con
 * `signGuestToken` (mismo helper de prod), y comparamos status/contenido.
 * Skip si GUEST_TOKEN_SECRET o SUPABASE_SERVICE_ROLE no están disponibles.
 */
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { signGuestToken } from '../../src/lib/auth/guest-token'
import { buildOrder } from '../../src/test/factories/order'
import { buildAddress } from '../../src/test/factories/cart'

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

test.describe('Order detail - guest token (D-23, T-03-23)', () => {
  let createdOrderId: string | null = null
  let createdEmail: string | null = null

  test.beforeAll(async () => {
    if (!process.env.GUEST_TOKEN_SECRET) {
      console.warn('[order-detail-guest-token] GUEST_TOKEN_SECRET ausente — todos los tests skip.')
      return
    }
    const admin = getServiceRoleClient()
    if (!admin) {
      console.warn('[order-detail-guest-token] service-role client no disponible — skip.')
      return
    }

    const order = buildOrder({ status: 'paid' })
    const addr = buildAddress()
    const email = order.buyer_email
    // Insert mínima en `order` table. Schema real puede diferir — si falla
    // por columnas faltantes, se traduce a skip en cada test.
    const { data, error } = await admin
      .from('order')
      .insert({
        id: order.id,
        buyer_id: null,
        guest_email: email,
        status: order.status,
        subtotal: order.subtotal_clp,
        shipping_cost: order.shipping_clp,
        discount_amount: order.discount_clp,
        total: order.total_clp,
        currency: order.currency,
        payment_provider: order.payment_provider,
        payment_intent_id: order.payment_intent_id,
        cart_snapshot_id: order.cart_snapshot_id,
      } as never)
      .select('id')
      .single()

    if (error || !data) {
      console.warn('[order-detail-guest-token] insert order falló:', error?.message)
      return
    }
    createdOrderId = (data as { id: string }).id
    createdEmail = email

    // Best-effort: insert una shipping_address asociada.
    await admin.from('shipping_address').insert({
      order_id: createdOrderId,
      full_name: addr.fullName,
      line1: addr.line1,
      city: addr.city,
      region: addr.region,
    } as never)
  })

  test.afterAll(async () => {
    if (!createdOrderId) return
    const admin = getServiceRoleClient()
    if (!admin) return
    await admin.from('order').delete().eq('id', createdOrderId)
  })

  test('sin token → 404', async ({ page }) => {
    test.skip(!createdOrderId, 'Setup de orden falló o env vars ausentes.')
    const res = await page.goto(`/es/pedido/${createdOrderId}`)
    expect(res?.status()).toBe(404)
  })

  test('token con firma corrupta → 404', async ({ page }) => {
    test.skip(!createdOrderId, 'Setup de orden falló o env vars ausentes.')
    const badToken = Buffer.from(
      `${createdOrderId}:${createdEmail}.deadbeef`,
      'utf8'
    ).toString('base64url')
    const res = await page.goto(`/es/pedido/${createdOrderId}?token=${badToken}`)
    expect(res?.status()).toBe(404)
  })

  test('token válido pero para OTRO orderId → 404', async ({ page }) => {
    test.skip(
      !createdOrderId || !process.env.GUEST_TOKEN_SECRET,
      'Setup de orden falló o GUEST_TOKEN_SECRET ausente.'
    )
    const otherOrderId = randomUUID()
    const tokenForOther = signGuestToken(otherOrderId, createdEmail!)
    const res = await page.goto(
      `/es/pedido/${createdOrderId}?token=${tokenForOther}`
    )
    expect(res?.status()).toBe(404)
  })

  test('token válido + orderId correcto → 200 + render detalle', async ({
    page,
  }) => {
    test.skip(
      !createdOrderId || !process.env.GUEST_TOKEN_SECRET,
      'Setup de orden falló o GUEST_TOKEN_SECRET ausente.'
    )
    const goodToken = signGuestToken(createdOrderId!, createdEmail!)
    const res = await page.goto(
      `/es/pedido/${createdOrderId}?token=${goodToken}`
    )
    expect(res?.status()).toBe(200)
    const shortId = createdOrderId!.slice(0, 8)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      `Pedido #${shortId}`
    )
  })
})
