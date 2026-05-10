/**
 * Phase 3 / Plan 03-07 — Cart fixture factory.
 *
 * Genera carts en el shape persistido por el store Zustand
 * (`crisol.cart.v1`, ver `tests/e2e/cart-persist.spec.ts`).
 *
 * NUNCA usar datos hardcoded en specs: invocar estos builders
 * desde `beforeEach` o casos puntuales.
 */
import { randomUUID } from 'node:crypto'

export type CartItemFixture = {
  productId: string
  variantId: string
  artisanId: string
  artisanName: string
  title: string
  unitPrice: number
  qty: number
}

export type CartFixture = {
  state: { items: CartItemFixture[] }
  version: 1
}

const TITLES = [
  'Aros plata 925 - hilatura artesanal',
  'Anillo cobre martillado',
  'Collar lapislazuli engaste plata',
  'Pulsera bronce trenzado',
  'Pendientes oro 18k arabesco',
]

export const CART_STORAGE_KEY = 'crisol.cart.v1'

export function buildCartItem(overrides: Partial<CartItemFixture> = {}): CartItemFixture {
  const idx = Math.floor(Math.random() * TITLES.length)
  return {
    productId: overrides.productId ?? randomUUID(),
    variantId: overrides.variantId ?? randomUUID(),
    artisanId: overrides.artisanId ?? randomUUID(),
    artisanName: overrides.artisanName ?? `Artesana Test ${Math.random().toString(36).slice(2, 6)}`,
    title: overrides.title ?? TITLES[idx],
    unitPrice: overrides.unitPrice ?? 15000 + idx * 5000,
    qty: overrides.qty ?? 1,
  }
}

/** Cart con un solo artesano y N items. Útil para flows simples. */
export function buildSingleArtisanCart(itemCount = 1, overrides: Partial<CartItemFixture> = {}): CartFixture {
  const artisanId = overrides.artisanId ?? randomUUID()
  const artisanName = overrides.artisanName ?? 'Artesana A'
  const items: CartItemFixture[] = []
  for (let i = 0; i < itemCount; i++) {
    items.push(buildCartItem({ artisanId, artisanName, ...overrides }))
  }
  return { state: { items }, version: 1 }
}

/** Cart con 3 items de 2 artesanos distintos (multi-artisan happy path). */
export function buildMultiArtisanCart(): CartFixture {
  const artisanA = { artisanId: randomUUID(), artisanName: 'Artesana A' }
  const artisanB = { artisanId: randomUUID(), artisanName: 'Artesano B' }
  return {
    state: {
      items: [
        buildCartItem({ ...artisanA, unitPrice: 25000, qty: 2, title: 'Aros plata' }),
        buildCartItem({ ...artisanA, unitPrice: 12000, qty: 1, title: 'Anillo plata' }),
        buildCartItem({ ...artisanB, unitPrice: 18000, qty: 1, title: 'Anillo cobre' }),
      ],
    },
    version: 1,
  }
}

/** Cart con subtotal explícito (útil para tests de cupón con min_order). */
export function buildCartWithSubtotal(subtotal: number): CartFixture {
  return buildSingleArtisanCart(1, { unitPrice: subtotal, qty: 1 })
}

export function calcSubtotal(cart: CartFixture): number {
  return cart.state.items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
}

export type AddressFixture = {
  fullName: string
  line1: string
  line2: string
  city: string
  region: string
  countryCode: string
  postalCode: string
  phone: string
}

export function buildAddress(overrides: Partial<AddressFixture> = {}): AddressFixture {
  const suffix = Math.random().toString(36).slice(2, 6)
  return {
    fullName: overrides.fullName ?? `Comprador Test ${suffix}`,
    line1: overrides.line1 ?? `Av. Providencia ${100 + Math.floor(Math.random() * 900)}`,
    line2: overrides.line2 ?? '',
    city: overrides.city ?? 'Providencia',
    region: overrides.region ?? 'metropolitana',
    countryCode: overrides.countryCode ?? 'CL',
    postalCode: overrides.postalCode ?? '7500000',
    phone: overrides.phone ?? '+56912345678',
  }
}
