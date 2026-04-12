import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_LOCALE } from '@/lib/utils/constants'

export default async function ArtesanoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/${DEFAULT_LOCALE}/auth/login`)

  const { data: profile } = await supabase
    .from('user')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'artisan' && profile?.role !== 'admin') {
    redirect(`/${DEFAULT_LOCALE}`)
  }

  return <div className="min-h-screen">{children}</div>
}
