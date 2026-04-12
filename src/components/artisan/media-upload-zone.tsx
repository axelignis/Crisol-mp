'use client'

import { useState, useRef, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X, ImagePlus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { getUploadSignature, uploadToCloudinary } from '@/lib/cloudinary/upload'
import { MAX_PHOTOS_PER_PRODUCT } from '@/lib/utils/constants'
import type { MediaFormData } from '@/types/catalog.types'

interface MediaUploadZoneProps {
  productId: string
  initialMedia?: MediaFormData[]
  onChange: (media: MediaFormData[]) => void
}

interface MediaItem extends MediaFormData {
  _localPreview?: string
  _uploading?: boolean
}

function SortableThumb({
  item,
  onSetCover,
  onDelete,
}: {
  item: MediaItem
  onSetCover: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id ?? item.cloudinary_id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative group w-20 h-20 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing"
      onClick={onSetCover}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item._localPreview ?? item.url}
        alt="Foto de pieza"
        className="w-full h-full object-cover"
      />
      {item.is_cover && (
        <div className="absolute inset-0 ring-2 ring-zinc-900 rounded-lg pointer-events-none" />
      )}
      {item._uploading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <span className="text-white text-xs font-medium">Subiendo...</span>
        </div>
      )}
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onDelete()
        }}
        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

export function MediaUploadZone({
  initialMedia = [],
  onChange,
}: MediaUploadZoneProps) {
  const [items, setItems] = useState<MediaItem[]>(initialMedia)
  const [isDragOver, setIsDragOver] = useState(false)
  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const atLimit = items.length >= MAX_PHOTOS_PER_PRODUCT

  const emitChange = useCallback(
    (updated: MediaItem[]) => {
      onChange(
        updated
          .filter(m => !m._uploading)
          .map(({ _localPreview, _uploading, ...m }) => ({
            ...m,
            // Strip internal fields
          }))
      )
    },
    [onChange]
  )

  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files).filter(f =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    )

    const remaining = MAX_PHOTOS_PER_PRODUCT - items.length
    const toUpload = fileArray.slice(0, remaining)

    if (toUpload.length === 0) return

    // Create preview items
    const newItems: MediaItem[] = toUpload.map((file, i) => ({
      url: '',
      cloudinary_id: `temp-${Date.now()}-${i}`,
      sort_order: items.length + i,
      is_cover: items.length === 0 && i === 0,
      _localPreview: URL.createObjectURL(file),
      _uploading: true,
    }))

    const updated = [...items, ...newItems]
    setItems(updated)

    // Upload each file
    for (let i = 0; i < toUpload.length; i++) {
      try {
        const sig = await getUploadSignature()
        const result = await uploadToCloudinary(toUpload[i], sig)

        setItems(prev => {
          const idx = prev.findIndex(
            m => m.cloudinary_id === newItems[i].cloudinary_id
          )
          if (idx === -1) return prev
          const copy = [...prev]
          copy[idx] = {
            ...copy[idx],
            url: result.secure_url,
            cloudinary_id: result.public_id,
            _uploading: false,
            _localPreview: undefined,
          }
          emitChange(copy)
          return copy
        })
      } catch {
        toast.error(
          'No se pudo subir la imagen. Verifica el formato (JPG, PNG o WebP) y que no exceda 10 MB.'
        )
        // Remove failed item
        setItems(prev => {
          const filtered = prev.filter(
            m => m.cloudinary_id !== newItems[i].cloudinary_id
          )
          emitChange(filtered)
          return filtered
        })
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setItems(prev => {
      const oldIdx = prev.findIndex(
        m => (m.id ?? m.cloudinary_id) === active.id
      )
      const newIdx = prev.findIndex(
        m => (m.id ?? m.cloudinary_id) === over.id
      )
      const reordered = arrayMove(prev, oldIdx, newIdx).map((m, i) => ({
        ...m,
        sort_order: i,
      }))
      emitChange(reordered)
      return reordered
    })
  }

  function setCover(index: number) {
    setItems(prev => {
      const updated = prev.map((m, i) => ({ ...m, is_cover: i === index }))
      emitChange(updated)
      return updated
    })
  }

  function requestDelete(index: number) {
    // If this would leave 0 photos, show confirmation
    if (items.length === 1) {
      setDeleteConfirmIdx(index)
      return
    }
    performDelete(index)
  }

  function performDelete(index: number) {
    setItems(prev => {
      const filtered = prev.filter((_, i) => i !== index)
      // If deleted item was cover, make first item cover
      if (prev[index].is_cover && filtered.length > 0) {
        filtered[0].is_cover = true
      }
      const reordered = filtered.map((m, i) => ({ ...m, sort_order: i }))
      emitChange(reordered)
      return reordered
    })
    setDeleteConfirmIdx(null)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Fotos</h2>

      {/* Drop zone */}
      {!atLimit && (
        <div
          onDragOver={e => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setIsDragOver(false)
            handleFiles(e.dataTransfer.files)
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg min-h-[200px] flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
            isDragOver
              ? 'border-zinc-900 bg-zinc-50'
              : 'border-zinc-300 hover:border-zinc-400'
          }`}
        >
          <ImagePlus className="size-8 text-zinc-400" />
          <p className="text-sm text-zinc-600">
            Arrastra fotos aqui o haz clic para seleccionar
          </p>
          <p className="text-xs text-zinc-400">
            Maximo {MAX_PHOTOS_PER_PRODUCT} fotos (JPG, PNG o WebP)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={e => {
              if (e.target.files) handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      )}

      {atLimit && (
        <p className="text-sm text-zinc-500">
          Has alcanzado el maximo de {MAX_PHOTOS_PER_PRODUCT} fotos.
        </p>
      )}

      {/* Thumbnail grid */}
      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map(m => m.id ?? m.cloudinary_id)}
            strategy={rectSortingStrategy}
          >
            <div className="flex gap-2 flex-wrap">
              {items.map((item, i) => (
                <SortableThumb
                  key={item.id ?? item.cloudinary_id}
                  item={item}
                  onSetCover={() => setCover(i)}
                  onDelete={() => requestDelete(i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmIdx !== null}
        onOpenChange={open => {
          if (!open) setDeleteConfirmIdx(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar foto</DialogTitle>
            <DialogDescription>
              Esta foto sera eliminada permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirmIdx !== null) performDelete(deleteConfirmIdx)
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
