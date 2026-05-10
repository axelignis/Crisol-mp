import { setRequestLocale } from 'next-intl/server'
import { CheckoutForm } from '@/components/checkout/checkout-form'
import { createClient } from '@/lib/supabase/server'

export const metadata = { robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user ?? null

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 lg:py-12">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Checkout</h1>
      <CheckoutForm
        locale={locale}
        initialEmail={user?.email_confirmed_at ? user.email ?? undefined : undefined}
        buyerId={user?.email_confirmed_at ? user.id : null}
      />
    </main>
  )
}
