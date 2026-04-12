import { SplitScreenLayout } from '@/components/auth/split-screen-layout'
import { AuthForm } from '@/components/auth/auth-form'

export default function RegistroPage() {
  return (
    <SplitScreenLayout title="Crear cuenta" subtitle="Registrate para comprar">
      <AuthForm mode="register" />
    </SplitScreenLayout>
  )
}
