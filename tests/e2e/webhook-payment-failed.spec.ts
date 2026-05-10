/**
 * Phase 3 / Plan 03-08 — Webhook Stripe `payment_failed` + eventos ignorados (COMR-08).
 *
 * Cubre dos paths del switch en `/api/webhooks/stripe`:
 *  - `payment_intent.payment_failed` → 200 `{received: true}` sin orderId
 *    (log only, no order creada).
 *  - Cualquier `event.type` no manejado → 200 `{received: true, ignored: <type>}`.
 *
 * Estrategia: HTTP directo con firma manual (mismo patrón que
 * webhook-idempotency.spec.ts). Skip si STRIPE_WEBHOOK_SECRET ausente.
 */
import { test, expect, request as playwrightRequest } from '@playwright/test'
import { signStripeWebhook } from '../../src/test/utils/sign-stripe-webhook'

const WEBHOOK_PATH = '/api/webhooks/stripe'

function buildPaymentFailedEvent(eventId: string) {
  return {
    id: eventId,
    object: 'event',
    type: 'payment_intent.payment_failed',
    api_version: '2024-09-30.acacia',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `pi_test_${eventId.slice(-12)}`,
        object: 'payment_intent',
        amount: 50000,
        currency: 'clp',
        status: 'requires_payment_method',
        last_payment_error: { message: 'card_declined' },
      },
    },
  }
}

function buildUnhandledEvent(eventId: string) {
  // `customer.created` es un evento real de Stripe pero NO lo dispatchamos.
  return {
    id: eventId,
    object: 'event',
    type: 'customer.created',
    api_version: '2024-09-30.acacia',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `cus_test_${eventId.slice(-12)}`,
        object: 'customer',
        email: 'unrelated@example.com',
      },
    },
  }
}

test.describe('Webhook Stripe - payment_failed + ignored (COMR-08)', () => {
  test('payment_intent.payment_failed retorna received sin crear orden', async ({
    baseURL,
  }) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET || null
    test.skip(
      !secret,
      'STRIPE_WEBHOOK_SECRET no configurado en el runner — necesario para firmar el payload de test.'
    )
    test.skip(!baseURL, 'PLAYWRIGHT_BASE_URL no configurado.')

    const eventId = `evt_test_failed_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`
    const event = buildPaymentFailedEvent(eventId)
    const { body, signature } = signStripeWebhook(event, secret!)

    const ctx = await playwrightRequest.newContext({ baseURL })
    const res = await ctx.post(WEBHOOK_PATH, {
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      data: body,
    })
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
    expect(json.orderId, 'payment_failed NO debe crear order').toBeUndefined()
    expect(json.error, 'payment_failed NO debe reportar error').toBeUndefined()

    await ctx.dispose()
  })

  test('event.type no manejado retorna ignored: <type>', async ({ baseURL }) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET || null
    test.skip(!secret, 'STRIPE_WEBHOOK_SECRET no configurado en el runner.')
    test.skip(!baseURL, 'PLAYWRIGHT_BASE_URL no configurado.')

    const eventId = `evt_test_ignored_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`
    const event = buildUnhandledEvent(eventId)
    const { body, signature } = signStripeWebhook(event, secret!)

    const ctx = await playwrightRequest.newContext({ baseURL })
    const res = await ctx.post(WEBHOOK_PATH, {
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      data: body,
    })
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
    expect(json.ignored).toBe('customer.created')

    await ctx.dispose()
  })
})
