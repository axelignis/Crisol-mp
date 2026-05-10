'use client'
// Gate SSR-safe: dispara rehydrate de Zustand persist tras montar el componente cliente.
// Evita hydration mismatch en componentes que dependen del cart store.
import { useEffect, useState } from 'react'
import { useCartStore } from '@/store/cart.store'

export function useCartHydration() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    let cancelled = false
    useCartStore.persist.rehydrate()?.then(() => {
      if (!cancelled) setHydrated(true)
    })
    // Si ya está hidratado (rehydrate sincrónico o segunda llamada), marcar.
    if (useCartStore.persist.hasHydrated()) setHydrated(true)
    return () => {
      cancelled = true
    }
  }, [])
  return hydrated
}
