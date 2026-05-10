'use client'
// Wrapper de selectors del cart store con guard de hidratación.
// Si !hydrated retorna estructuras vacías para evitar mismatch SSR.
import { useMemo } from 'react'
import { useCartStore } from '@/store/cart.store'
import { useCartHydration } from '@/hooks/use-cart-hydration'
import type { CartItem, CartItemsByArtisan } from '@/types/cart'

export function useCart() {
  const hydrated = useCartHydration()
  const items = useCartStore((s) => s.items)
  const add = useCartStore((s) => s.add)
  const remove = useCartStore((s) => s.remove)
  const setQty = useCartStore((s) => s.setQty)
  const clear = useCartStore((s) => s.clear)

  const visibleItems: CartItem[] = hydrated ? items : []

  const count = useMemo(
    () => visibleItems.reduce((acc, i) => acc + i.qty, 0),
    [visibleItems]
  )

  const subtotal = useMemo(
    () => visibleItems.reduce((acc, i) => acc + i.unitPrice * i.qty, 0),
    [visibleItems]
  )

  const byArtisan: CartItemsByArtisan[] = useMemo(() => {
    const map = new Map<string, CartItemsByArtisan>()
    for (const item of visibleItems) {
      const existing = map.get(item.artisanId)
      if (existing) {
        existing.items.push(item)
        existing.subtotal += item.unitPrice * item.qty
      } else {
        map.set(item.artisanId, {
          artisanId: item.artisanId,
          artisanName: item.artisanName,
          items: [item],
          subtotal: item.unitPrice * item.qty,
        })
      }
    }
    return Array.from(map.values())
  }, [visibleItems])

  return {
    items: visibleItems,
    count,
    subtotal,
    byArtisan,
    add,
    remove,
    setQty,
    clear,
    hydrated,
  }
}
