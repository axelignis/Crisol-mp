// Phase 3 Plan 04 — Interim confirmacion page.
// El webhook (Plan 05) crea la order; aquí mostramos un estado de espera.
// El detalle final llega en Plan 06 (`/pedido/{id}`).
import { setRequestLocale } from 'next-intl/server'
import Link from 'next/link'

export const metadata = { robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

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
