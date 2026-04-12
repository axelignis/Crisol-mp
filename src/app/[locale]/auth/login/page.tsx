import { SplitScreenLayout } from '@/components/auth/split-screen-layout'
import { AuthForm } from '@/components/auth/auth-form'

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return (
    <SplitScreenLayout title="Iniciar sesion" subtitle="Ingresa a tu cuenta">
      <AuthForm mode="login" locale={locale} />
    </SplitScreenLayout>
  )
}
