/**
 * Phase 3 Plan 06 — /pedido/[id] (RSC).
 *
 * Auth check:
 *  - Logged buyer: RLS por (buyer_id == auth.uid()).
 *  - Guest: query param `token` HMAC-firmado debe verificar y orderId debe coincidir.
 *
 * Threat mitigations:
 *  - T-03-23 (IDOR): el doble check (RLS o token) garantiza que solo el
 *    receptor legitimo vea la orden.
 *  - Guest path usa service_role SOLO tras verifyGuestToken success.
 */
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { verifyGuestToken } from '@/lib/auth/guest-token'

export const metadata = { robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

type OrderItem = {
  snapshot_title: string
  unit_price: number
  quantity: number
  total_price: number
  artisan_id: string
}

type Shipment = {
  courier: string
  tracking_number: string | null
  status: string
  estimated_delivery: string | null
  artisan_id: string
}

type ShippingAddress = {
  full_name: string
  line1: string
  city: string
  region: string
}

type OrderDetail = {
  id: string
  status: string
  total: number
  subtotal: number
  shipping_cost: number
  discount_amount: number
  created_at: string
  buyer_id: string | null
  guest_email: string | null
  order_item: OrderItem[]
  shipping_address: ShippingAddress | null
  shipment: Shipment[]
}

const formatCLP = (n: number) =>
  `$${Math.round(n).toLocaleString('es-CL')} CLP`

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { locale, id } = await params
  const sp = await searchParams
  setRequestLocale(locale)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let authorized = false

  if (user) {
    const { data: ownership } = await supabase
      .from('order')
      .select('id, buyer_id')
      .eq('id', id)
      .single()
    if (ownership) {
      const { data: buyerRow } = await supabase
        .from('buyer')
        .select('id')
        .eq('user_id', user.id)
        .single()
      const buyerId = (buyerRow as { id?: string } | null)?.id
      if (buyerId && (ownership as { buyer_id?: string | null }).buyer_id === buyerId) {
        authorized = true
      }
    }
  }

  if (!authorized && sp.token) {
    const verified = verifyGuestToken(sp.token)
    if (verified && verified.orderId === id) {
      authorized = true
    }
  }

  if (!authorized) {
    notFound()
  }

  // Service role para detalle completo (post-auth)
  const admin = createServiceRoleClient()
  const { data: order, error } = await admin
    .from('order')
    .select('*, order_item(*), shipping_address(*), shipment(*)')
    .eq('id', id)
    .single()

  if (error || !order) {
    notFound()
  }

  const o = order as unknown as OrderDetail
  const shortId = o.id.slice(0, 8)

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Pedido #{shortId}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Confirmado el {new Date(o.created_at).toLocaleDateString('es-CL')} ·{' '}
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
            {o.status}
          </span>
        </p>
      </div>

      <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-900">Detalle</h2>
        <ul className="divide-y divide-zinc-100">
          {o.order_item.map((item, i) => (
            <li
              key={i}
              className="flex items-center justify-between py-2 text-sm text-zinc-700"
            >
              <span>
                {item.quantity}× {item.snapshot_title}
              </span>
              <span className="font-medium text-zinc-900">
                {formatCLP(item.unit_price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
        <div className="flex justify-between py-1 text-zinc-700">
          <span>Subtotal</span>
          <span>{formatCLP(o.subtotal)}</span>
        </div>
        <div className="flex justify-between py-1 text-zinc-700">
          <span>Envío</span>
          <span>{formatCLP(o.shipping_cost)}</span>
        </div>
        {o.discount_amount > 0 && (
          <div className="flex justify-between py-1 text-zinc-700">
            <span>Descuento</span>
            <span>-{formatCLP(o.discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-900">
          <span>Total</span>
          <span>{formatCLP(o.total)}</span>
        </div>
      </section>

      {o.shipment.length > 0 && (
        <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-zinc-900">Envíos</h2>
          <ul className="space-y-2 text-sm text-zinc-700">
            {o.shipment.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium text-zinc-900">{s.courier}</span>
                  {s.tracking_number ? ` · ${s.tracking_number}` : ''} · {s.status}
                </span>
                {s.estimated_delivery && (
                  <span className="text-xs text-zinc-500">
                    Entrega estimada {s.estimated_delivery}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {o.shipping_address && (
        <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
          <h2 className="mb-3 text-sm font-medium text-zinc-900">Dirección</h2>
          <p>
            {o.shipping_address.full_name}
            <br />
            {o.shipping_address.line1}
            <br />
            {o.shipping_address.city}, {o.shipping_address.region}
          </p>
        </section>
      )}
    </main>
  )
}
