import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getMyPieces } from '@/lib/actions/piece-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-700',
  pending_review: 'bg-amber-500 text-white',
  published: 'bg-green-600 text-white',
  changes_requested: 'bg-amber-500 text-white',
  rejected: 'bg-red-500 text-white',
  sold: 'bg-zinc-500 text-white',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  pending_review: 'En revision',
  published: 'Publicada',
  changes_requested: 'Cambios solicitados',
  rejected: 'Rechazada',
  sold: 'Vendida',
}

export default async function MisPiezasPage() {
  const pieces = await getMyPieces()

  if (pieces.length === 0) {
    return (
      <main className="p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h1 className="text-xl font-semibold">No tienes piezas creadas</h1>
        <p className="text-sm text-zinc-500">
          Crea tu primera pieza y comparte tu arte.
        </p>
        <Link href="/artesano/piezas/nueva">
          <Button>
            <Plus className="size-4 mr-1" />
            Crear pieza
          </Button>
        </Link>
      </main>
    )
  }

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Mis piezas</h1>
        <Link href="/artesano/piezas/nueva">
          <Button>
            <Plus className="size-4 mr-1" />
            Crear pieza
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pieces.map(piece => (
          <Link
            key={piece.id}
            href={`/artesano/piezas/${piece.id}/editar`}
            className="group block border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Cover photo */}
            <div className="aspect-square bg-zinc-100 relative">
              {piece.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={piece.cover_url}
                  alt={piece.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-300">
                  Sin foto
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium text-sm line-clamp-1 group-hover:underline">
                  {piece.title}
                </h2>
                <Badge
                  className={`shrink-0 text-xs ${STATUS_STYLES[piece.status] ?? ''}`}
                >
                  {STATUS_LABELS[piece.status] ?? piece.status}
                </Badge>
              </div>

              <p className="text-sm text-zinc-600">
                ${piece.base_price.toLocaleString('es-CL')} CLP
              </p>

              {/* D-08: Rejection notes for changes_requested */}
              {piece.status === 'changes_requested' && piece.rejection_notes && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-3 text-sm text-amber-900">
                  {piece.rejection_notes}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
