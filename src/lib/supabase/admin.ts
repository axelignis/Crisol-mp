/**
 * Supabase service-role client (server-only).
 *
 * Phase 3 Plan 05: el webhook de Stripe (/api/webhooks/stripe) corre con
 * service_role para bypassar RLS y poder leer cart_snapshot, insertar order,
 * order_item, payment, artisan_payout, etc.
 *
 * SEGURIDAD CRITICA:
 * - NUNCA importar este modulo desde un Client Component ('use client').
 * - SUPABASE_SERVICE_ROLE jamas debe llegar al bundle del browser.
 * - El nombre del archivo (admin.ts) y la ausencia de 'use client' son las
 *   guardas; complementadas por una busqueda grep en CI.
 *
 * Lazy init: la throw por env var faltante se difiere al primer uso real
 * (mismo patron que stripe/client.ts) para no romper `next build`.
 */
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

let _instance: SupabaseClient | null = null

export function createServiceRoleClient(): SupabaseClient {
  if (_instance) return _instance
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) {
    throw new Error('[supabase/admin] NEXT_PUBLIC_SUPABASE_URL no esta definida.')
  }
  if (!key) {
    throw new Error(
      '[supabase/admin] SUPABASE_SERVICE_ROLE no esta definida. Configurar en .env.local (dev) o Vercel env vars (prod). Server-only.',
    )
  }
  _instance = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _instance
}
