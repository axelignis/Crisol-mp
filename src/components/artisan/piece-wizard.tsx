'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { VariantTable } from '@/components/artisan/variant-table'
import { MediaUploadZone } from '@/components/artisan/media-upload-zone'
import {
  savePieceDraft,
  saveVariants,
  saveMedia,
  submitForReview,
  updatePublishedPiece,
} from '@/lib/actions/piece-actions'
import type { VariantFormData, MediaFormData, PieceType } from '@/types/catalog.types'

const STEPS = ['Info basica', 'Variantes', 'Fotos', 'Revisar y enviar'] as const

const step1Schema = z.object({
  type: z.enum(['jewelry_unique', 'jewelry_series', 'decorative']),
  title: z.string().min(3, 'Minimo 3 caracteres').max(200),
  description: z.string().max(2000),
  base_price: z.coerce.number().int().min(0, 'Precio debe ser mayor o igual a 0'),
  category_id: z.string().uuid().nullable(),
})

type Step1Values = z.infer<typeof step1Schema>

interface PieceWizardProps {
  initialData?: {
    id: string
    title: string
    description: string | null
    base_price: number
    type: PieceType
    status: string
    category_id: string | null
    product_variant: VariantFormData[]
    product_media: MediaFormData[]
  }
  productId?: string
}

export function PieceWizard({ initialData, productId: initialProductId }: PieceWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [productId, setProductId] = useState<string | null>(initialProductId ?? null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isPending, startTransition] = useTransition()
  const [variants, setVariants] = useState<VariantFormData[]>(
    initialData?.product_variant ?? []
  )
  const [media, setMedia] = useState<MediaFormData[]>(
    initialData?.product_media ?? []
  )

  const isPublished = initialData?.status === 'published'

  const form = useForm<Step1Values, unknown, Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      type: (initialData?.type as Step1Values['type']) ?? 'jewelry_series',
      title: initialData?.title ?? '',
      description: initialData?.description ?? '',
      base_price: initialData?.base_price ?? 0,
      category_id: initialData?.category_id ?? null,
    },
  })

  const pieceType = form.watch('type')

  async function showSaveStatus() {
    setSaveStatus('saving')
    return () => {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  async function handleNext() {
    if (currentStep === 0) {
      const valid = await form.trigger()
      if (!valid) return

      const values = form.getValues()
      startTransition(async () => {
        const done = await showSaveStatus()
        try {
          if (isPublished) {
            await updatePublishedPiece(productId!, values)
          } else {
            const id = await savePieceDraft(productId, values)
            setProductId(id)
          }
          done()
          setCurrentStep(1)
        } catch {
          setSaveStatus('idle')
          toast.error('No se pudieron guardar los cambios. Intenta de nuevo.')
        }
      })
    } else if (currentStep === 1) {
      if (!productId) return
      startTransition(async () => {
        const done = await showSaveStatus()
        try {
          const result = await saveVariants(productId, variants)
          setVariants(result.map(r => ({
            id: r.id,
            size: r.size,
            material: r.material,
            color: r.color,
            stones: r.stones,
            price_modifier: r.price_modifier,
            stock: r.stock,
          })))
          done()
          setCurrentStep(2)
        } catch {
          setSaveStatus('idle')
          toast.error('No se pudieron guardar los cambios. Intenta de nuevo.')
        }
      })
    } else if (currentStep === 2) {
      if (!productId) return
      startTransition(async () => {
        const done = await showSaveStatus()
        try {
          const result = await saveMedia(productId, media)
          setMedia(result.map(r => ({
            id: r.id,
            url: r.url,
            cloudinary_id: r.cloudinary_id ?? '',
            sort_order: r.sort_order,
            is_cover: r.is_cover,
          })))
          done()
          setCurrentStep(3)
        } catch {
          setSaveStatus('idle')
          toast.error('No se pudieron guardar los cambios. Intenta de nuevo.')
        }
      })
    }
  }

  async function handleSubmit() {
    if (!productId) return
    startTransition(async () => {
      try {
        await submitForReview(productId)
        toast.success('Pieza enviada a revision')
        router.push('/artesano/piezas')
      } catch {
        toast.error('No se pudo enviar la pieza. Verifica que tenga titulo y al menos 1 foto.')
      }
    })
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-1 flex-1">
            <div className="flex items-center w-full">
              {i > 0 && (
                <div
                  className={`h-0.5 flex-1 ${
                    i <= currentStep ? 'bg-zinc-900' : 'bg-zinc-200'
                  }`}
                />
              )}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                  i < currentStep
                    ? 'bg-green-600 text-white'
                    : i === currentStep
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-500'
                }`}
              >
                {i < currentStep ? <Check className="size-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 ${
                    i < currentStep ? 'bg-zinc-900' : 'bg-zinc-200'
                  }`}
                />
              )}
            </div>
            <span className="text-sm font-semibold text-zinc-700">{label}</span>
          </div>
        ))}
      </div>

      {/* Save status indicator */}
      {saveStatus !== 'idle' && (
        <div className="flex items-center gap-1.5 text-sm text-zinc-500 mb-4">
          {saveStatus === 'saving' ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Check className="size-3.5 text-green-600" />
              Guardado
            </>
          )}
        </div>
      )}

      {/* Step 1: Info basica */}
      {currentStep === 0 && (
        <Form {...form}>
          <form className="space-y-6">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de pieza</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="jewelry_unique">Pieza unica</SelectItem>
                      <SelectItem value="jewelry_series">Serie</SelectItem>
                      <SelectItem value="decorative">Arte decorativo</SelectItem>
                    </SelectContent>
                  </Select>
                  {pieceType === 'jewelry_unique' && (
                    <FormDescription>Stock fijo: 1 unidad</FormDescription>
                  )}
                  {pieceType === 'jewelry_series' && (
                    <FormDescription>Stock se configura por variante</FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titulo</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nombre de tu pieza" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripcion</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Describe tu pieza, materiales, tecnica..."
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="base_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Precio base (CLP)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      )}

      {/* Step 2: Variantes */}
      {currentStep === 1 && productId && (
        <VariantTable
          productId={productId}
          initialVariants={variants}
          pieceType={pieceType as PieceType}
          onChange={setVariants}
        />
      )}

      {/* Step 3: Fotos */}
      {currentStep === 2 && productId && (
        <MediaUploadZone
          productId={productId}
          initialMedia={media}
          onChange={setMedia}
        />
      )}

      {/* Step 4: Revisar y enviar */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Revisar pieza</h2>

          <div className="space-y-3">
            <div>
              <span className="text-sm text-zinc-500">Tipo:</span>{' '}
              <span className="font-medium">{form.getValues('type')}</span>
            </div>
            <div>
              <span className="text-sm text-zinc-500">Titulo:</span>{' '}
              <span className="font-medium">{form.getValues('title')}</span>
            </div>
            {form.getValues('description') && (
              <div>
                <span className="text-sm text-zinc-500">Descripcion:</span>{' '}
                <span>{form.getValues('description')}</span>
              </div>
            )}
            <div>
              <span className="text-sm text-zinc-500">Precio base:</span>{' '}
              <span className="font-medium">
                ${form.getValues('base_price').toLocaleString('es-CL')} CLP
              </span>
            </div>
          </div>

          {/* Variants summary */}
          {variants.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Variantes ({variants.length})</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="text-left px-3 py-2">Tipo/Valor</th>
                      <th className="text-right px-3 py-2">Stock</th>
                      <th className="text-right px-3 py-2">Modificador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, i) => (
                      <tr key={v.id ?? i} className="border-t">
                        <td className="px-3 py-2">
                          {v.size || v.material || v.color || v.stones || '-'}
                        </td>
                        <td className="text-right px-3 py-2">{v.stock}</td>
                        <td className="text-right px-3 py-2">
                          {v.price_modifier >= 0 ? '+' : ''}
                          ${v.price_modifier.toLocaleString('es-CL')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Photos summary */}
          {media.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Fotos ({media.length})</h3>
              <div className="flex gap-2 flex-wrap">
                {media
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((m, i) => (
                    <div
                      key={m.id ?? i}
                      className={`w-20 h-20 rounded-lg overflow-hidden ${
                        m.is_cover ? 'ring-2 ring-zinc-900' : ''
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.url}
                        alt={`Foto ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
              </div>
            </div>
          )}

          <p className="text-sm text-zinc-500">
            Todo listo. Al enviar, un administrador revisara tu pieza.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        {currentStep > 0 ? (
          <Button
            variant="outline"
            onClick={() => setCurrentStep(s => s - 1)}
            disabled={isPending}
          >
            Atras
          </Button>
        ) : (
          <div />
        )}

        {currentStep < 3 ? (
          <Button
            onClick={handleNext}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            Siguiente
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-zinc-900 text-white hover:bg-zinc-800"
          >
            {isPending ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            Enviar a revision
          </Button>
        )}
      </div>
    </div>
  )
}
