/**
 * Phase 3 / Plan 03-08 — Webhook idempotency stress (COMR-07 reforzado).
 *
 * Stripe retry agresivo: dispara N=5 POSTs concurrentes con el mismo
 * `event.id`. Garantía esperada:
 *  - exactamente 1 fila en `webhook_event` (PK insert).
 *  - exactamente 1 respuesta sin `duplicate: true` (la "ganadora" de la race
 *    condition de inserción).
 *  - las restantes deben retornar `duplicate: true`.
 *
 * Si SUPABASE_SERVICE_ROLE no está disponible, sólo validamos el invariante
 * HTTP (1 no-duplicate + 4 duplicates). Eso es suficiente para COMR-07.
 */
import { test, expect, request as playwrightRequest } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import {
  signStripeWebhook,
  buildPaymentIntentSucceededEvent,
} from '../../src/test/utils/sign-stripe-webhook'

const WEBHOOK_PATH = '/api/webhooks/stripe'
const CONCURRENT = 5

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

test.describe('Webhook Stripe - stress idempotency (COMR-07)', () => {
  test('5 POSTs concurrentes mismo event.id → 1 winner + 4 duplicates', async ({
    baseURL,
  }) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET || null
    test.skip(
      !secret,
      'STRIPE_WEBHOOK_SECRET no configurado — necesario para firmar payload.'
    )
    test.skip(!baseURL, 'PLAYWRIGHT_BASE_URL no configurado.')

    const eventId = `evt_test_stress_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`
    const event = buildPaymentIntentSucceededEvent({
      eventId,
      metadata: {}, // sin snapshot — order creation falla, idempotencia sigue válida
    })
    const { body, signature } = signStripeWebhook(event, secret!)

    const ctx = await playwrightRequest.newContext({ baseURL })

    // Lanzar N requests sin awaitar individualmente — Promise.all los paraleliza.
    const responses = await Promise.all(
      Array.from({ length: CONCURRENT }).map(() =>
        ctx.post(WEBHOOK_PATH, {
          headers: {
            'content-type': 'application/json',
            'stripe-signature': signature,
          },
          data: body,
        })
      )
    )

    // Todas 200.
    for (const r of responses) {
      expect(r.status()).toBe(200)
    }

    const jsons = await Promise.all(responses.map((r) => r.json()))
    const duplicates = jsons.filter((j) => j.duplicate === true).length
    const winners = jsons.filter((j) => j.duplicate !== true).length

    // Invariante: exactamente uno gana el insert.
    expect(winners, 'exactamente 1 ganador del insert PK').toBe(1)
    expect(duplicates, `${CONCURRENT - 1} respuestas marcadas duplicate`).toBe(
      CONCURRENT - 1
    )

    // Verificación opcional vía service-role.
    const admin = getServiceRoleClient()
    if (admin) {
      const { count, error } = await admin
        .from('webhook_event')
        .select('id', { count: 'exact', head: true })
        .eq('id', eventId)
      expect(error).toBeNull()
      expect(count, 'una sola fila webhook_event para event.id').toBe(1)
    } else {
      test.info().annotations.push({
        type: 'note',
        description:
          'Service-role no disponible — verificación HTTP únicamente.',
      })
    }

    await ctx.dispose()
  })
})
