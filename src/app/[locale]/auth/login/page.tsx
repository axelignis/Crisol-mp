import { SplitScreenLayout } from '@/components/auth/split-screen-layout'
import { AuthForm } from '@/components/auth/auth-form'

export default function LoginPage() {
  return (
    <SplitScreenLayout title="Iniciar sesion" subtitle="Ingresa a tu cuenta">
      <AuthForm mode="login" />
    </SplitScreenLayout>
  )
}
