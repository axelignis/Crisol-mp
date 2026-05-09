import { getPendingProducts } from '@/lib/queries/product-queries'
import { ModerationQueue } from '@/components/admin/moderation-queue'

export default async function ModerationPage() {
  const products = await getPendingProducts()

  return (
    <main className="p-6">
      <h1 className="mb-4 text-2xl font-semibold text-zinc-900">
        Moderacion de piezas
      </h1>
      <ModerationQueue initialPieces={products} />
    </main>
  )
}
