// Header con logo + nav básica + cart trigger (Phase 3).
// Server component que renderiza la cart-sheet (client) — sólo UI minimal por ahora.
import Link from 'next/link'
import { CartSheet } from '@/components/cart/cart-sheet'
import { CartHydration } from '@/components/cart/cart-hydration'

interface HeaderProps {
  locale: string
}

export function Header({ locale }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-zinc-100 bg-white/80 px-4 backdrop-blur-sm sm:px-6"
      data-testid="site-header"
    >
      {/* Mount once: triggers cart store rehydration globally. */}
      <CartHydration />

      <Link
        href={`/${locale}`}
        className="font-heading text-lg font-semibold text-zinc-900"
      >
        Crisol
      </Link>

      <nav className="hidden items-center gap-6 text-sm text-zinc-600 sm:flex">
        <Link href={`/${locale}/catalogo`} className="hover:text-zinc-900">
          Catalogo
        </Link>
        <Link href={`/${locale}/artesanos`} className="hover:text-zinc-900">
          Artesanos
        </Link>
        <Link href={`/${locale}/blog`} className="hover:text-zinc-900">
          Blog
        </Link>
      </nav>

      <div className="flex items-center gap-2">
        <CartSheet />
      </div>
    </header>
  )
}
