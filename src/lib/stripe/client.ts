/**
 * Stripe server-side SDK singleton.
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
 */
import Stripe from 'stripe'

const secretKey = process.env.STRIPE_SECRET_KEY

if (!secretKey) {
  throw new Error(
    '[stripe] STRIPE_SECRET_KEY no esta definida. Configurar en .env.local (dev) o Vercel env vars (prod). Ver crisol.env.example.',
  )
}

// Pinned to '2024-06-20' per Phase 3 plan (research Pitfall 7). The SDK type
// accepts only the latest version string; we cast to keep the pin intentional.
// Update both this version AND `package.json` `stripe` dep deliberately with tests.
const STRIPE_API_VERSION = '2024-06-20' as Stripe.LatestApiVersion

export const stripe = new Stripe(secretKey, {
  apiVersion: STRIPE_API_VERSION,
  typescript: true,
})
