// Phase 3 Plan 06 — Confirmacion redirect.
// El webhook de Stripe (Plan 05) crea la orden async; aqui hacemos lookup
// best-effort por stripe_payment_intent_id y redirigimos a /pedido/{id}.
// Si la orden todavia no existe (race con webhook), mostramos espera.
import { setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { signGuestToken } from '@/lib/auth/guest-token'
import { createClient } from '@/lib/supabase/server'

export const metadata = { robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

async function findOrderIdByPaymentIntent(piId: string): Promise<string | null> {
  try {
    const admin = createServiceRoleClient()
    const { data } = await admin
      .from('payment')
      .select('order_id')
      .eq('stripe_payment_intent_id', piId)
      .single()
    return (data as { order_id?: string } | null)?.order_id ?? null
  } catch {
    return null
  }
}

export default async function ConfirmacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { locale } = await params
  const sp = await searchParams
  setRequestLocale(locale)

  const snapshot = sp.snapshot ?? ''
  const piIntent = sp.payment_intent ?? ''
  const piStatus = sp.redirect_status ?? ''

  if (piIntent && (piStatus === 'succeeded' || piStatus === '')) {
    const orderId = await findOrderIdByPaymentIntent(piIntent)
    if (orderId) {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        redirect(`/${locale}/pedido/${orderId}`)
      }
      // Guest path: fetch guest_email para firmar magic-link
      try {
        const admin = createServiceRoleClient()
        const { data: order } = await admin
          .from('order')
          .select('guest_email, buyer_id')
          .eq('id', orderId)
          .single()
        const o = order as { guest_email?: string | null; buyer_id?: string | null } | null
        if (o?.guest_email && !o.buyer_id) {
          const token = signGuestToken(orderId, o.guest_email)
          redirect(`/${locale}/pedido/${orderId}?token=${token}`)
        }
        redirect(`/${locale}/pedido/${orderId}`)
      } catch {
        // fallthrough a estado de espera
      }
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-zinc-900">Pedido en proceso</h1>
      <p className="mb-6 text-sm text-zinc-600">
        Estamos confirmando tu pago. Recibirás un correo con los detalles del pedido apenas se procese.
      </p>
      <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
        {snapshot && <div>Snapshot: <code className="text-xs text-zinc-500">{snapshot}</code></div>}
        {piIntent && <div>Pago: <code className="text-xs text-zinc-500">{piIntent}</code></div>}
        {piStatus && <div>Estado: <span className="font-medium">{piStatus}</span></div>}
      </div>
      <div className="mt-6">
        <Link href={`/${locale}/cuenta/pedidos`} className="text-sm text-zinc-900 underline">
          Ver mis pedidos
        </Link>
      </div>
    </main>
  )
}
