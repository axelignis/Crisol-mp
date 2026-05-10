/**
 * Phase 3 / Plan 03-07 — Helper para firmar payloads Stripe en tests E2E.
 *
 * Usa `stripe.webhooks.generateTestHeaderString` (oficial Stripe SDK) para
 * producir un header `stripe-signature` válido sin depender de `stripe listen`.
 * Útil para verificar idempotencia y dispatch end-to-end.
 *
 * NUNCA usar el secret de producción aquí — sólo `STRIPE_WEBHOOK_SECRET`
 * de `.env.local` o un secret de prueba dedicado.
 */
import Stripe from 'stripe'

export function signStripeWebhook(payload: object, secret: string): {
  body: string
  signature: string
} {
  const body = JSON.stringify(payload)
  // Stripe SDK provee este helper sólo para tests.
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret,
  })
  return { body, signature }
}

/**
 * Construye un evento `payment_intent.succeeded` mínimo con los campos que
 * `createOrderFromPayment` lee. event.id determina idempotencia.
 */
export function buildPaymentIntentSucceededEvent(opts: {
  eventId: string
  paymentIntentId?: string
  amount?: number
  metadata?: Record<string, string>
}) {
  return {
    id: opts.eventId,
    object: 'event',
    type: 'payment_intent.succeeded',
    api_version: '2024-09-30.acacia',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: opts.paymentIntentId ?? `pi_test_${opts.eventId.slice(-12)}`,
        object: 'payment_intent',
        amount: opts.amount ?? 50000,
        currency: 'clp',
        status: 'succeeded',
        metadata: opts.metadata ?? {},
      },
    },
  }
}
