'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import { approvePiece, requestChanges, rejectPiece } from '@/lib/actions/moderation-actions'
import { formatCLP } from '@/lib/utils/format'

// Normalized type for component use
interface PendingProduct {
  id: string
  title: string
  slug: string
  description: string | null
  base_price: number
  type: string
  status: string
  created_at: string
  artisanName: string
  variants: { id: string; size: string | null; material: string | null; color: string | null; stones: string | null; price_modifier: number; stock: number }[]
  media: { id: string; url: string; sort_order: number; is_cover: boolean; type: string }[]
}

type RawUser = { full_name: string | null } | { full_name: string | null }[] | null | undefined
type RawArtisan = { id: string; slug: string; user: RawUser } | { id: string; slug: string; user: RawUser }[] | null | undefined

interface RawPiece {
  id: string
  title: string
  slug: string
  description: string | null
  base_price: number
  type: string
  status: string
  created_at: string
  artisan: RawArtisan
  variants?: PendingProduct['variants']
  media?: PendingProduct['media']
}

function normalizePieces(raw: RawPiece[]): PendingProduct[] {
  return raw.map(p => {
    const artisan = Array.isArray(p.artisan) ? p.artisan[0] : p.artisan
    const user = artisan?.user
    const fullName = Array.isArray(user) ? user[0]?.full_name : user?.full_name
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      description: p.description,
      base_price: p.base_price,
      type: p.type,
      status: p.status,
      created_at: p.created_at,
      artisanName: fullName ?? 'Artesano',
      variants: p.variants ?? [],
      media: p.media ?? [],
    }
  })
}

interface ModerationQueueProps {
  initialPieces: RawPiece[]
}

export function ModerationQueue({ initialPieces }: ModerationQueueProps) {
  const [pieces, setPieces] = useState<PendingProduct[]>(() => normalizePieces(initialPieces))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')

  const selected = pieces.find(p => p.id === selectedId) ?? null

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  function removePiece(id: string) {
    setPieces(prev => prev.filter(p => p.id !== id))
    setSelectedId(null)
    setFeedback('')
    setMobileView('list')
  }

  async function handleApprove() {
    if (!selectedId) return
    setLoading(true)
    try {
      await approvePiece(selectedId)
      removePiece(selectedId)
      showToast('Pieza aprobada')
    } catch (e) {
      showToast('Error al aprobar pieza')
    } finally {
      setLoading(false)
    }
  }

  async function handleRequestChanges() {
    if (!selectedId || !feedback.trim()) return
    setLoading(true)
    try {
      await requestChanges(selectedId, feedback)
      removePiece(selectedId)
      showToast('Cambios solicitados')
    } catch (e) {
      showToast('Error al solicitar cambios')
    } finally {
      setLoading(false)
    }
  }

  async function handleReject() {
    if (!selectedId) return
    setLoading(true)
    try {
      await rejectPiece(selectedId, feedback || null)
      removePiece(selectedId)
      showToast('Pieza rechazada')
    } catch (e) {
      showToast('Error al rechazar pieza')
    } finally {
      setLoading(false)
    }
  }

  function selectPiece(id: string) {
    setSelectedId(id)
    setFeedback('')
    setMobileView('detail')
  }

  function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return 'hace menos de 1h'
    if (hours < 24) return `hace ${hours}h`
    const days = Math.floor(hours / 24)
    return `hace ${days}d`
  }

  // Empty state
  if (pieces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-zinc-900">No hay piezas pendientes</p>
        <p className="mt-1 text-sm text-zinc-500">Todas las piezas han sido revisadas.</p>
      </div>
    )
  }

  // --- Mobile: toggle list/detail ---
  const showListMobile = mobileView === 'list'

  return (
    <div className="relative flex h-[calc(100vh-120px)]">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Left panel: piece list */}
      <div className={`w-full shrink-0 overflow-y-auto border-r border-zinc-200 lg:block lg:w-80 ${showListMobile ? 'block' : 'hidden'}`}>
        {pieces.map(piece => (
          <button
            key={piece.id}
            onClick={() => selectPiece(piece.id)}
            className={`flex w-full flex-col gap-0.5 border-b border-zinc-100 px-4 py-3 text-left transition-colors hover:bg-zinc-50 ${
              selectedId === piece.id ? 'border-l-[3px] border-l-zinc-900 bg-zinc-50' : ''
            }`}
          >
            <span className="text-sm font-semibold text-zinc-900">{piece.title}</span>
            <span className="text-sm text-zinc-500">
              {piece.artisanName}
            </span>
            <span className="text-sm text-zinc-400">{relativeTime(piece.created_at)}</span>
          </button>
        ))}
      </div>

      {/* Right panel: detail */}
      <div className={`flex-1 overflow-y-auto p-6 lg:block ${!showListMobile ? 'block' : 'hidden lg:block'}`}>
        {!selected ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Selecciona una pieza para revisar
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-6">
            {/* Mobile back button */}
            <button
              onClick={() => setMobileView('list')}
              className="mb-2 text-sm text-zinc-500 underline lg:hidden"
            >
              Volver a la lista
            </button>

            {/* Header */}
            <div>
              <h2 className="text-xl font-semibold text-zinc-900">{selected.title}</h2>
              <div className="mt-1 flex flex-wrap gap-3 text-sm text-zinc-500">
                <span>Tipo: {selected.type}</span>
                <span>Precio: {formatCLP(selected.base_price)}</span>
                <span>Artesano: {selected.artisanName}</span>
              </div>
              {selected.description && (
                <p className="mt-3 text-sm text-zinc-600">{selected.description}</p>
              )}
            </div>

            {/* Gallery thumbnails */}
            {selected.media.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.media
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map(m => (
                    <div
                      key={m.id}
                      className={`h-20 w-20 overflow-hidden rounded-lg border ${
                        m.is_cover ? 'ring-2 ring-zinc-900' : 'border-zinc-200'
                      }`}
                    >
                      <Image
                        src={m.url}
                        alt=""
                        width={80}
                        height={80}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
              </div>
            )}

            {/* Variants table */}
            {selected.variants.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-zinc-500">
                      <th className="pb-2 pr-4 font-medium">Talla</th>
                      <th className="pb-2 pr-4 font-medium">Material</th>
                      <th className="pb-2 pr-4 font-medium">Color</th>
                      <th className="pb-2 pr-4 font-medium">Piedras</th>
                      <th className="pb-2 pr-4 font-medium">Stock</th>
                      <th className="pb-2 font-medium">Modificador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.variants.map(v => (
                      <tr key={v.id} className="border-b border-zinc-100">
                        <td className="py-2 pr-4">{v.size ?? '-'}</td>
                        <td className="py-2 pr-4">{v.material ?? '-'}</td>
                        <td className="py-2 pr-4">{v.color ?? '-'}</td>
                        <td className="py-2 pr-4">{v.stones ?? '-'}</td>
                        <td className="py-2 pr-4">{v.stock}</td>
                        <td className="py-2">{v.price_modifier > 0 ? `+${formatCLP(v.price_modifier)}` : formatCLP(v.price_modifier)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Feedback textarea */}
            <div>
              <Textarea
                placeholder="Mensaje para el artesano"
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                className="min-h-24"
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleApprove}
                disabled={loading}
                className="bg-zinc-900 text-white hover:bg-zinc-800"
              >
                Aprobar pieza
              </Button>
              <Button
                onClick={handleRequestChanges}
                disabled={loading || !feedback.trim()}
                variant="secondary"
                className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
              >
                Pedir cambios
              </Button>

              {/* Reject with confirmation dialog */}
              <Dialog>
                <DialogTrigger
                  render={
                    <Button
                      disabled={loading}
                      variant="destructive"
                      className="bg-red-500 text-white hover:bg-red-600"
                    />
                  }
                >
                  Rechazar pieza
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Rechazar pieza</DialogTitle>
                    <DialogDescription>
                      Esta accion notificara al artesano y la pieza no sera publicada. Confirmar?
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>
                      Cancelar
                    </DialogClose>
                    <Button
                      onClick={handleReject}
                      disabled={loading}
                      className="bg-red-500 text-white hover:bg-red-600"
                    >
                      Si, rechazar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
