'use client'

import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Database } from '@/types/database.types'

type ProductMediaRow = Database['public']['Tables']['product_media']['Row']

interface ProductGalleryProps {
  media: ProductMediaRow[]
}

export function ProductGallery({ media }: ProductGalleryProps) {
  const sorted = [...media].sort((a, b) => a.sort_order - b.sort_order)
  const coverIndex = sorted.findIndex(m => m.is_cover)
  const [selectedIndex, setSelectedIndex] = useState(coverIndex >= 0 ? coverIndex : 0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const current = sorted[selectedIndex]

  const goNext = useCallback(() => {
    setSelectedIndex(i => (i + 1) % sorted.length)
  }, [sorted.length])

  const goPrev = useCallback(() => {
    setSelectedIndex(i => (i - 1 + sorted.length) % sorted.length)
  }, [sorted.length])

  useEffect(() => {
    if (!lightboxOpen) return
    function handleKeyboard(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [lightboxOpen, goNext, goPrev])

  if (!sorted.length) return null

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <button
        type="button"
        className="relative aspect-square w-full max-w-[600px] cursor-pointer overflow-hidden rounded-lg bg-zinc-100"
        onClick={() => setLightboxOpen(true)}
      >
        {current && (
          <Image
            src={current.url}
            alt=""
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        )}
      </button>

      {/* Thumbnail row */}
      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {sorted.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md ${
                i === selectedIndex ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-200'
              }`}
              onClick={() => setSelectedIndex(i)}
            >
              <Image
                src={m.url}
                alt=""
                fill
                className="object-cover"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          className="fixed inset-0 flex max-w-none items-center justify-center rounded-none border-none bg-black/90 p-0 sm:max-w-none"
          showCloseButton={false}
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-50 rounded-full bg-white/20 p-2 text-white hover:bg-white/40"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="h-6 w-6" />
            <span className="sr-only">Cerrar</span>
          </button>

          {sorted.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/40"
                onClick={goPrev}
              >
                <ChevronLeft className="h-8 w-8" />
                <span className="sr-only">Anterior</span>
              </button>
              <button
                type="button"
                className="absolute right-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/40"
                onClick={goNext}
              >
                <ChevronRight className="h-8 w-8" />
                <span className="sr-only">Siguiente</span>
              </button>
            </>
          )}

          {current && (
            <div className="relative h-[80vh] w-[80vw]">
              <Image
                src={current.url}
                alt=""
                fill
                className="object-contain"
                sizes="80vw"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
