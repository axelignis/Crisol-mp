import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PieceWizard } from '@/components/artisan/piece-wizard'

export default async function NuevaPiezaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/es/auth/login')

  // Check if artisan has an existing draft
  const { data: artisan } = await supabase
    .from('artisan')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artisan) redirect('/artesano')

  const { data: existingDraft } = await supabase
    .from('product')
    .select('id')
    .eq('artisan_id', artisan.id)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existingDraft) {
    redirect(`/artesano/piezas/${existingDraft.id}/editar`)
  }

  return (
    <main className="p-8">
      <PieceWizard />
    </main>
  )
}
