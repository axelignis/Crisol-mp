/**
 * Phase 3 Plan 06 — GET /api/orders/[id].
 *
 * Auth check identico a /pedido/[id] (logged buyer via RLS / guest via token).
 * Util para refresh dinamico desde Phase 4 dashboards o polling cliente.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { verifyGuestToken } from '@/lib/auth/guest-token'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(req.url)
  const token = url.searchParams.get('token') ?? undefined

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

  if (!authorized && token) {
    const verified = verifyGuestToken(token)
    if (verified && verified.orderId === id) {
      authorized = true
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const admin = createServiceRoleClient()
  const { data: order, error } = await admin
    .from('order')
    .select('*, order_item(*), shipping_address(*), shipment(*)')
    .eq('id', id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ order })
}
