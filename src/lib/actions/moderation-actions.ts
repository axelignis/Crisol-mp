'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { resend, FROM_EMAIL } from '@/lib/resend/client'
import { PieceApprovedEmail } from '@/lib/resend/templates/piece-approved'
import { PieceRejectedEmail, getSubject } from '@/lib/resend/templates/piece-rejected'

// --- Zod Schemas ---

const approveSchema = z.object({
  productId: z.string().uuid(),
})

const requestChangesSchema = z.object({
  productId: z.string().uuid(),
  feedback: z.string().min(1, 'Feedback requerido').max(2000),
})

const rejectSchema = z.object({
  productId: z.string().uuid(),
  feedback: z.string().max(2000).nullable(),
})

// --- Helpers ---

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('user')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Forbidden: admin role required')
  return { supabase, user }
}

async function getArtisanEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  artisanId: string
): Promise<{ email: string; name: string }> {
  const { data: artisan } = await supabase
    .from('artisan')
    .select('user:user_id (email, full_name)')
    .eq('id', artisanId)
    .single()

  const user = (artisan as any)?.user
  return {
    email: user?.email ?? '',
    name: user?.full_name ?? 'Artesano',
  }
}

// --- Server Actions ---

export async function approvePiece(productId: string) {
  const validated = approveSchema.parse({ productId })
  const { supabase, user } = await requireAdmin()

  // Transition via state machine RPC
  const { error: rpcErr } = await supabase.rpc('transition_product_status', {
    p_product_id: validated.productId,
    p_new_status: 'published',
    p_actor_id: user.id,
  })
  if (rpcErr) throw new Error(rpcErr.message)

  // Fetch product details for email and revalidation
  const { data: product } = await supabase
    .from('product')
    .select('title, slug, artisan_id, artisan:artisan_id (slug)')
    .eq('id', validated.productId)
    .single()

  if (!product) throw new Error('Product not found after transition')

  // Send approval email
  const artisanSlug = (product.artisan as any)?.slug
  const { email, name } = await getArtisanEmail(supabase, product.artisan_id)
  const pieceUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://crisol.cl'}/es/catalogo/${product.slug}`

  if (email) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `Tu pieza fue aprobada - ${product.title}`,
        react: PieceApprovedEmail({ artisanName: name, pieceTitle: product.title, pieceUrl }),
      })
    } catch (e) {
      console.error('Failed to send approval email:', e)
    }
  }

  // ISR revalidation
  revalidatePath('/es/catalogo')
  if (product.slug) revalidatePath(`/es/catalogo/${product.slug}`)
  if (artisanSlug) revalidatePath(`/es/artesanos/${artisanSlug}`)

  return { success: true }
}

export async function requestChanges(productId: string, feedback: string) {
  const validated = requestChangesSchema.parse({ productId, feedback })
  const { supabase, user } = await requireAdmin()

  // Transition via state machine RPC
  const { error: rpcErr } = await supabase.rpc('transition_product_status', {
    p_product_id: validated.productId,
    p_new_status: 'changes_requested',
    p_actor_id: user.id,
    p_notes: validated.feedback,
  })
  if (rpcErr) throw new Error(rpcErr.message)

  // Fetch product details for email
  const { data: product } = await supabase
    .from('product')
    .select('title, artisan_id')
    .eq('id', validated.productId)
    .single()

  if (!product) throw new Error('Product not found after transition')

  const { email, name } = await getArtisanEmail(supabase, product.artisan_id)
  const editUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://crisol.cl'}/artesano/piezas/${validated.productId}/editar`

  if (email) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: getSubject('changes_requested', product.title),
        react: PieceRejectedEmail({
          artisanName: name,
          pieceTitle: product.title,
          feedback: validated.feedback,
          status: 'changes_requested',
          editUrl,
        }),
      })
    } catch (e) {
      console.error('Failed to send changes-requested email:', e)
    }
  }

  return { success: true }
}

export async function rejectPiece(productId: string, feedback: string | null) {
  const validated = rejectSchema.parse({ productId, feedback })
  const { supabase, user } = await requireAdmin()

  // Transition via state machine RPC
  const { error: rpcErr } = await supabase.rpc('transition_product_status', {
    p_product_id: validated.productId,
    p_new_status: 'rejected',
    p_actor_id: user.id,
    p_notes: validated.feedback,
  })
  if (rpcErr) throw new Error(rpcErr.message)

  // Fetch product details for email
  const { data: product } = await supabase
    .from('product')
    .select('title, artisan_id')
    .eq('id', validated.productId)
    .single()

  if (!product) throw new Error('Product not found after transition')

  const { email, name } = await getArtisanEmail(supabase, product.artisan_id)

  if (email) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: getSubject('rejected', product.title),
        react: PieceRejectedEmail({
          artisanName: name,
          pieceTitle: product.title,
          feedback: validated.feedback,
          status: 'rejected',
        }),
      })
    } catch (e) {
      console.error('Failed to send rejection email:', e)
    }
  }

  return { success: true }
}
