/**
 * Phase 3 Plan 05 — POST /api/webhooks/stripe
 *
 * Verifica firma con stripe.webhooks.constructEvent, garantiza idempotencia
 * por event.id (PK insert en webhook_event con detección 23505), y dispatcha
 * a createOrderFromPayment para `payment_intent.succeeded`.
 *
 * Threat mitigations:
 * - T-03-16 (Spoofing): constructEvent valida HMAC + timestamp tolerance.
 * - T-03-17 (Repudiation/duplicate): PK insert en webhook_event; 23505 -> 200 duplicate.
 * - T-03-18 (Tampering): `await req.text()` ANTES de constructEvent — nunca req.json().
 * - T-03-19 (DoS por Stripe retry): errores post-firma siempre devuelven 200
 *   con flag de reconciliacion en webhook_event.error_message. Stripe NO debe
 *   reintentar un PI ya succeeded.
 */
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import {
  createOrderFromPayment,
  StockInsufficientError,
  SnapshotNotFoundError,
  CouponLimitReachedError,
} from '@/lib/orders/create-from-payment'
import { sendOrderConfirmedEmail } from '@/lib/resend/send-order-confirmed'

// Health probe (manual debug)
export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(req: Request) {
  // 1. RAW body — nunca req.json() antes de constructEvent (T-03-18)
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET no configurado')
    return NextResponse.json({ error: 'webhook_secret_missing' }, { status: 500 })
  }

  let event: { id: string; type: string; data: { object: Record<string, unknown> } }
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret) as unknown as typeof event
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[stripe-webhook] signature verification failed:', msg)
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // 2. Idempotencia: PK insert en webhook_event. 23505 = duplicate = ya procesado.
  const { error: idemErr } = await supabase.from('webhook_event').insert({
    id: event.id,
    source: 'stripe',
    event_type: event.type,
    payload: event as unknown as object,
  })
  if (idemErr) {
    if ((idemErr as { code?: string }).code === '23505') {
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error('[stripe-webhook] idempotency insert failed:', idemErr)
    return NextResponse.json({ error: 'idempotency_store_failed' }, { status: 500 })
  }

  // 3. Dispatch por event.type
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as { id?: string }
      const piId = pi.id ?? ''
      try {
        const { orderId } = await createOrderFromPayment({ event: event as never, supabase })
        // Best-effort email (Plan 06): nunca bloquea el webhook.
        await sendOrderConfirmedEmail(orderId).catch((emailErr) => {
          console.error('[stripe-webhook] sendOrderConfirmedEmail failed:', emailErr)
        })
        // WR-01: NO incluir orderId en la respuesta a Stripe (queda persistido
        // en webhook_event y order; el cliente Stripe no necesita verlo).
        return NextResponse.json({ received: true })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[stripe-webhook] order creation failed:', msg)

        // CR-03: si el pago ya succeeded pero no podemos crear la orden por
        // stock/snapshot/cupon, refund automatico. El cliente NO debe quedar
        // cobrado sin orden. TODO(phase-4): notificar al buyer via email/sms.
        const shouldAutoRefund =
          piId &&
          (e instanceof StockInsufficientError ||
            e instanceof SnapshotNotFoundError ||
            e instanceof CouponLimitReachedError)

        let finalErrorMessage = msg
        if (shouldAutoRefund) {
          try {
            const refund = await stripe.refunds.create({
              payment_intent: piId,
              reason: 'requested_by_customer',
            })
            finalErrorMessage = `${msg} | refunded_automatically:${refund.id}`
          } catch (refundErr) {
            const refundMsg = refundErr instanceof Error ? refundErr.message : String(refundErr)
            console.error('[stripe-webhook] auto-refund failed:', refundMsg)
            finalErrorMessage = `${msg} | refund_failed:${refundMsg}`
          }
        }

        // CRITICO: el pago ya succeeded; devolver 5xx haria que Stripe reintente
        // y procesemos duplicado. En lugar de eso flagear para reconciliacion.
        await supabase
          .from('webhook_event')
          .update({ error_message: finalErrorMessage })
          .eq('id', event.id)

        // WR-01: NO exponer detalles internos a Stripe (queda en DB).
        return NextResponse.json({ received: true })
      }
    }

    case 'payment_intent.payment_failed': {
      const piId = (event.data.object as { id?: string }).id ?? 'unknown'
      console.warn('[stripe-webhook] payment_failed', piId)
      // Phase 3: log unicamente. No order creada. Phase 4 puede agregar alertas.
      return NextResponse.json({ received: true })
    }

    default:
      return NextResponse.json({ received: true, ignored: event.type })
  }
}
