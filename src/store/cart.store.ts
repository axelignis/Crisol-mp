// Phase 3 - Cart store (Plan 03-02)
// Decisión D-02: persiste en localStorage para guests y logged users (Zustand persist).
// `skipHydration: true` evita mismatch SSR — el gate `useCartHydration` dispara rehydrate.
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CartItem } from '@/types/cart'

export type CartState = {
  items: CartItem[]
  add: (item: CartItem) => void
  remove: (variantId: string) => void
  setQty: (variantId: string, qty: number) => void
  clear: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        if (item.qty <= 0) return
        const items = get().items
        const existing = items.find((i) => i.variantId === item.variantId)
        if (existing) {
          set({
            items: items.map((i) =>
              i.variantId === item.variantId
                ? { ...i, qty: i.qty + item.qty }
                : i
            ),
          })
        } else {
          set({ items: [...items, item] })
        }
      },
      remove: (variantId) => {
        set({ items: get().items.filter((i) => i.variantId !== variantId) })
      },
      setQty: (variantId, qty) => {
        if (qty <= 0) {
          set({ items: get().items.filter((i) => i.variantId !== variantId) })
          return
        }
        set({
          items: get().items.map((i) =>
            i.variantId === variantId ? { ...i, qty } : i
          ),
        })
      },
      clear: () => set({ items: [] }),
    }),
    {
      name: 'crisol.cart.v1',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? window.localStorage
          : (undefined as unknown as Storage)
      ),
      skipHydration: true,
      version: 1,
    }
  )
)
