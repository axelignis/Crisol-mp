/**
 * Stripe server-side SDK singleton (lazy init).
 *
 * Phase 3 D-SPLIT: single-account model. NO Stripe Connect, NO transfers.
 * The platform account charges the buyer directly; artisan payouts are
 * recorded in `artisan_payout` and liquidated manually outside Stripe.
 *
 * Server-only — DO NOT import from client components. STRIPE_SECRET_KEY
 * must never reach the browser bundle.
 *
 * apiVersion is pinned per Pitfall 7 (research): Stripe auto-upgrades break
 * webhook payloads silently otherwise. Update intentionally with tests.
 *
 * The instance is wrapped in a Proxy so that Next.js can collect page data
 * without STRIPE_SECRET_KEY at build-time. The error fires on first
 * paymentIntents.create / etc. — never at module-load.
 */
import Stripe from 'stripe'

// Pinned to '2024-06-20' per Phase 3 plan (research Pitfall 7). The SDK type
// accepts only the latest version string; we cast to keep the pin intentional.
const STRIPE_API_VERSION = '2024-06-20' as Stripe.LatestApiVersion

let _instance: Stripe | null = null
function getInstance(): Stripe {
  if (_instance) return _instance
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error(
      '[stripe] STRIPE_SECRET_KEY no esta definida. Configurar en .env.local (dev) o Vercel env vars (prod). Ver crisol.env.example.',
    )
  }
  _instance = new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  })
  return _instance
}

// Proxy: lazy-resolves Stripe properties. Module load NEVER throws.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const inst = getInstance()
    const value = (inst as unknown as Record<string | symbol, unknown>)[prop as string]
    if (typeof value === 'function') return (value as (...args: unknown[]) => unknown).bind(inst)
    return value
  },
}) as Stripe
