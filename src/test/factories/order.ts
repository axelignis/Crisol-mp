/**
 * Phase 3 / Plan 03-07 — Order fixture factory.
 *
 * Constructor de filas para inserción server-side via service-role
 * (uso en specs que necesiten una orden pre-existente).
 */
import { randomUUID } from 'node:crypto'

export type OrderFixture = {
  id: string
  buyer_id: string | null
  buyer_email: string
  status: 'pending_payment' | 'paid' | 'in_preparation' | 'shipped' | 'delivered' | 'cancelled'
  subtotal_clp: number
  shipping_clp: number
  discount_clp: number
  commission_clp: number
  total_clp: number
  currency: string
  payment_provider: 'stripe' | 'coinbase'
  payment_intent_id: string | null
  shipping_address: Record<string, unknown>
  cart_snapshot_id: string | null
  created_at: string
}

export function buildOrder(overrides: Partial<OrderFixture> = {}): OrderFixture {
  const subtotal = overrides.subtotal_clp ?? 50000
  const shipping = overrides.shipping_clp ?? 5990
  const discount = overrides.discount_clp ?? 0
  const commission = overrides.commission_clp ?? Math.floor(subtotal * 0.1)
  return {
    id: overrides.id ?? randomUUID(),
    buyer_id: overrides.buyer_id ?? null,
    buyer_email: overrides.buyer_email ?? `buyer+${Math.random().toString(36).slice(2, 8)}@example.com`,
    status: overrides.status ?? 'paid',
    subtotal_clp: subtotal,
    shipping_clp: shipping,
    discount_clp: discount,
    commission_clp: commission,
    total_clp: overrides.total_clp ?? subtotal + shipping - discount,
    currency: overrides.currency ?? 'CLP',
    payment_provider: overrides.payment_provider ?? 'stripe',
    payment_intent_id: overrides.payment_intent_id ?? `pi_test_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
    shipping_address:
      overrides.shipping_address ?? {
        fullName: 'Comprador Test',
        line1: 'Av. Providencia 100',
        city: 'Providencia',
        region: 'metropolitana',
        countryCode: 'CL',
      },
    cart_snapshot_id: overrides.cart_snapshot_id ?? randomUUID(),
    created_at: overrides.created_at ?? new Date().toISOString(),
  }
}
