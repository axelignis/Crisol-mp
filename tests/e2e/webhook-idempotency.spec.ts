/**
 * Phase 3 / Plan 03-07 — Webhook Stripe idempotency (COMR-07).
 *
 * Verifica que enviar dos veces el mismo `event.id` al endpoint
 * `/api/webhooks/stripe` resulte en una sola fila `webhook_event` (PK insert
 * con detección de duplicado vía 23505 → 200 `duplicate: true`).
 *
 * Estrategia: HTTP directo con firma manual (`signStripeWebhook`). No
 * dependemos de `stripe listen` ni de Stripe live. El primer POST puede
 * resultar en `order_creation_failed` (no hay snapshot real), pero eso no
 * importa para idempotencia: la fila webhook_event ya está insertada y la
 * segunda llamada DEBE retornar `duplicate: true` antes de tocar
 * `createOrderFromPayment`.
 *
 * Requisitos de entorno (.env.local):
 *  - PLAYWRIGHT_BASE_URL apuntando a un dev server con `STRIPE_WEBHOOK_SECRET`
 *    configurado (mismo valor que usa el helper `signStripeWebhook`).
 *  - Si STRIPE_WEBHOOK_SECRET no está en process.env del runner, el spec se
 *    salta con mensaje explícito (mejor que false-fail en CI).
 *  - Opcional: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE para verificar
 *    el conteo en la tabla `webhook_event`. Si no están, sólo se valida la
 *    respuesta HTTP (assert lógico de COMR-07 sigue cubierto).
 */
import { test, expect, request as playwrightRequest } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import {
  signStripeWebhook,
  buildPaymentIntentSucceededEvent,
} from '../../src/test/utils/sign-stripe-webhook'

const WEBHOOK_PATH = '/api/webhooks/stripe'

function getSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null
}

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

test.describe('Webhook Stripe - idempotencia (COMR-07)', () => {
  test('mismo event.id procesado dos veces solo crea una fila webhook_event', async ({
    baseURL,
  }) => {
    const secret = getSecret()
    test.skip(
      !secret,
      'STRIPE_WEBHOOK_SECRET no configurado en el runner — necesario para firmar el payload de test.'
    )
    test.skip(!baseURL, 'PLAYWRIGHT_BASE_URL no configurado.')

    // Event id único — evita colisión con runs previos en DB compartida.
    const eventId = `evt_test_idem_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`

    const event = buildPaymentIntentSucceededEvent({
      eventId,
      // Sin cart_snapshot_id válido: createOrderFromPayment fallará con
      // NO_SNAPSHOT_ID. El webhook responderá 200 con error: order_creation_failed
      // pero la fila webhook_event ya quedó insertada → idempotencia activa.
      metadata: {},
    })

    const { body, signature } = signStripeWebhook(event, secret!)

    const ctx = await playwrightRequest.newContext({ baseURL })

    // 1) Primer POST.
    const res1 = await ctx.post(WEBHOOK_PATH, {
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      data: body,
    })
    expect(res1.status(), 'primer POST debe ser 200').toBe(200)
    const json1 = await res1.json()
    expect(json1.received, 'primer POST debe retornar received').toBe(true)
    // Puede traer orderId (si snapshot existe) o error: order_creation_failed.
    // Ambas son válidas — el invariante es que la fila webhook_event quedó.
    expect(json1.duplicate ?? false, 'primer POST NO es duplicate').toBe(false)

    // 2) Segundo POST — exact same body + signature.
    const res2 = await ctx.post(WEBHOOK_PATH, {
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      data: body,
    })
    expect(res2.status(), 'segundo POST debe ser 200').toBe(200)
    const json2 = await res2.json()
    expect(json2.received).toBe(true)
    expect(json2.duplicate, 'segundo POST DEBE marcar duplicate').toBe(true)

    // 3) (Opcional) Verificar count en DB si tenemos service-role.
    const admin = getServiceRoleClient()
    if (admin) {
      const { data, error, count } = await admin
        .from('webhook_event')
        .select('id', { count: 'exact', head: false })
        .eq('id', eventId)
      expect(error, 'select webhook_event no debe fallar').toBeNull()
      expect(count, 'exactamente una fila para event.id').toBe(1)
      expect(data?.length).toBe(1)
    } else {
      test.info().annotations.push({
        type: 'note',
        description:
          'Service-role no disponible en este runner — verificación HTTP únicamente (suficiente para COMR-07).',
      })
    }

    await ctx.dispose()
  })

  test('event con firma inválida es rechazado con 400', async ({ baseURL }) => {
    test.skip(!baseURL, 'PLAYWRIGHT_BASE_URL no configurado.')

    const ctx = await playwrightRequest.newContext({ baseURL })
    const event = buildPaymentIntentSucceededEvent({
      eventId: `evt_test_badsig_${Date.now()}`,
    })
    const res = await ctx.post(WEBHOOK_PATH, {
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=0,v1=deadbeef',
      },
      data: JSON.stringify(event),
    })
    expect(res.status()).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('invalid_signature')
    await ctx.dispose()
  })
})
