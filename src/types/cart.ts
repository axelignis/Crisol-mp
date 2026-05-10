// Phase 3 - Cart types (Plan 03-02)
// CartItem es display-only; el server recalcula totales canónicos en checkout.
export type CartItem = {
  productId: string
  variantId: string
  artisanId: string
  artisanName: string // snapshot display
  title: string // snapshot display
  unitPrice: number // CLP integer (base_price + variant.price_modifier)
  qty: number
  imageUrl?: string
}

export type CartItemsByArtisan = {
  artisanId: string
  artisanName: string
  items: CartItem[]
  subtotal: number
}

export type StockCheckRequestItem = {
  variantId: string
  qty: number
}

export type StockCheckResultItem = {
  variantId: string
  available: number
  requested: number
  sufficient: boolean
}

export type StockCheckResponse =
  | { ok: true; items: StockCheckResultItem[] }
  | { ok: false; insufficient: StockCheckResultItem[] }
