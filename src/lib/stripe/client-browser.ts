/**
 * Stripe.js browser singleton.
 *
 * `loadStripe` debe invocarse una sola vez por sesion de cliente para
 * evitar multiples scripts inyectados (warning documentado por Stripe).
 * Este modulo expone `getStripe()` que cachea la promesa.
 *
 * Solo usa NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_ / pk_live_) — segura en el cliente.
 */
import { loadStripe, type Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null> | null = null

export function getStripe(): Promise<Stripe | null> {
  if (stripePromise === null) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!key) {
      // Defer the throw to invocation time so SSR import does not crash;
      // surface a clear runtime error when checkout actually mounts.
      throw new Error(
        '[stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY no esta definida. Configurar en .env.local (dev) o Vercel env vars (prod).',
      )
    }
    stripePromise = loadStripe(key)
  }
  return stripePromise
}
