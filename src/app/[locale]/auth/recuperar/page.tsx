import { SplitScreenLayout } from '@/components/auth/split-screen-layout'
import { AuthForm } from '@/components/auth/auth-form'

export default async function RecuperarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return (
    <SplitScreenLayout title="Recuperar contrasena" subtitle="Te enviaremos un enlace para restablecer tu contrasena">
      <AuthForm mode="recover" locale={locale} />
    </SplitScreenLayout>
  )
}
