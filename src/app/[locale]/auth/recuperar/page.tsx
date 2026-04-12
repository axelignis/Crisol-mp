import { SplitScreenLayout } from '@/components/auth/split-screen-layout'
import { AuthForm } from '@/components/auth/auth-form'

export default function RecuperarPage() {
  return (
    <SplitScreenLayout title="Recuperar contrasena" subtitle="Te enviaremos un enlace para restablecer tu contrasena">
      <AuthForm mode="recover" />
    </SplitScreenLayout>
  )
}
