import type { Metadata } from 'next'
import { CartPageClient } from '@/components/cart/cart-page-client'

export const metadata: Metadata = {
  title: 'Carrito | Crisol',
  robots: { index: false, follow: false },
}

export default function CarritoPage() {
  return (
    <main className="min-h-[60vh]" data-testid="cart-page">
      <CartPageClient />
    </main>
  )
}
