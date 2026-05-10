'use client'
// Trigger global de rehydrate del cart store. Render vacío.
// Montar una sola vez en el árbol (locale layout o header).
import { useCartHydration } from '@/hooks/use-cart-hydration'

export function CartHydration() {
  useCartHydration()
  return null
}
