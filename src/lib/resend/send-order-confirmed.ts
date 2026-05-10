/**
 * Phase 3 Plan 06 — sendOrderConfirmedEmail.
 *
 * Carga la order + relaciones via service-role, resuelve email del receptor
 * (buyer.user.email para logged, guest_email para invitado), firma
 * magic-link si es invitado, y dispara Resend. Best-effort: errores se
 * loguean pero no propagan (el caller — webhook — no debe fallar el pago).
 */
import { Resend } from 'resend'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { signGuestToken } from '@/lib/auth/guest-token'
import { OrderConfirmedEmail } from '@/lib/resend/templates/order-confirmed'

type OrderRow = {
  id: string
  buyer_id: string | null
  guest_email: string | null
  total: number
  subtotal: number
  shipping_cost: number
  discount_amount: number
  commission_amount: number
  created_at: string
  status: string
  order_item: Array<{
    snapshot_title: string
    unit_price: number
    quantity: number
    artisan_id: string
  }>
  shipping_address: {
    full_name: string
    line1: string
    city: string
    region: string
  } | null
  shipment: Array<{
    courier: string
    estimated_delivery: string | null
    artisan_id: string
  }>
}

const FROM = process.env.RESEND_FROM_EMAIL ?? process.env.FROM_EMAIL ?? 'Crisol <noreply@crisol.cl>'

async function resolveBuyerEmail(supabase: ReturnType<typeof createServiceRoleClient>, buyerId: string): Promise<string | null> {
  // buyer.user_id -> auth.users.email (Supabase Auth)
  const { data: buyer, error: buyerErr } = await supabase
    .from('buyer')
    .select('user_id')
    .eq('id', buyerId)
    .single()
  if (buyerErr || !buyer || !(buyer as { user_id?: string }).user_id) return null

  // Path 1: Supabase Auth admin API
  try {
    const adminAuth = (supabase as unknown as { auth?: { admin?: { getUserById?: (id: string) => Promise<{ data: { user: { email?: string | null } | null }; error: unknown }> } } }).auth
    if (adminAuth?.admin?.getUserById) {
      const res = await adminAuth.admin.getUserById((buyer as { user_id: string }).user_id)
      const email = res?.data?.user?.email
      if (email) return email
    }
  } catch {
    // continue to fallback
  }

  // Path 2: public.user table fallback (if exists)
  try {
    const { data: userRow } = await supabase
      .from('user')
      .select('email')
      .eq('id', (buyer as { user_id: string }).user_id)
      .single()
    if (userRow && (userRow as { email?: string }).email) {
      return (userRow as { email: string }).email
    }
  } catch {
    // ignore
  }
  return null
}

export async function sendOrderConfirmedEmail(orderId: string): Promise<void> {
  try {
    const supabase = createServiceRoleClient()
    const { data: order, error } = await supabase
      .from('order')
      .select('*, order_item(*), shipping_address(*), shipment(*)')
      .eq('id', orderId)
      .single()

    if (error || !order) {
      console.error('[email] order-confirmed: order not found', orderId, error)
      return
    }

    const o = order as unknown as OrderRow
    let recipient: string | null = null
    let magicLinkToken: string | undefined

    if (o.buyer_id) {
      recipient = await resolveBuyerEmail(supabase, o.buyer_id)
    } else if (o.guest_email) {
      recipient = o.guest_email
      magicLinkToken = signGuestToken(orderId, o.guest_email)
    }

    if (!recipient) {
      console.error('[email] order-confirmed: no recipient resolved', orderId)
      return
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('[email] order-confirmed: RESEND_API_KEY missing')
      return
    }

    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from: FROM,
      to: recipient,
      subject: `Confirmación de pedido #${orderId.slice(0, 8)}`,
      react: OrderConfirmedEmail({ order: o, magicLinkToken }),
    })

    if (result && (result as { error?: unknown }).error) {
      console.error('[email] order-confirmed: send error', (result as { error: unknown }).error)
    }
  } catch (e) {
    // Best-effort: nunca propaga al webhook (el pago ya succeeded).
    console.error('[email] order-confirmed: unexpected error', e)
  }
}
