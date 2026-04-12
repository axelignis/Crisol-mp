import { SplitScreenLayout } from '@/components/auth/split-screen-layout'
import { AuthForm } from '@/components/auth/auth-form'

export default async function RegistroPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return (
    <SplitScreenLayout title="Crear cuenta" subtitle="Registrate para comprar">
      <AuthForm mode="register" locale={locale} />
    </SplitScreenLayout>
  )
}
