'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface AuthFormProps {
  mode: 'login' | 'register' | 'recover'
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const supabase = createClient()

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('Credenciales incorrectas. Intenta de nuevo.')
        setLoading(false)
        return
      }
      router.push('/es')
      router.refresh()
      return
    }

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/es/auth/callback`,
        },
      })
      if (error) {
        setError('No se pudo crear la cuenta. Intenta con otro email.')
        setLoading(false)
        return
      }
      router.push('/es?verified=false')
      return
    }

    if (mode === 'recover') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/es/auth/callback?next=/es/auth/reset-password`,
      })
      if (error) {
        setError('No se pudo enviar el correo. Intenta de nuevo.')
        setLoading(false)
        return
      }
      setSuccess('Revisa tu bandeja de entrada para restablecer tu contrasena.')
      setLoading(false)
      return
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md px-3 py-2">
          {success}
        </div>
      )}

      {mode === 'register' && (
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre completo
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
            placeholder="Tu nombre"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
          placeholder="tu@email.com"
        />
      </div>

      {mode !== 'recover' && (
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Contrasena
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
            placeholder="Minimo 6 caracteres"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-stone-900 text-white rounded-md py-2 w-full hover:bg-stone-800 disabled:opacity-50 text-sm font-medium transition-colors"
      >
        {loading
          ? 'Cargando...'
          : mode === 'login'
            ? 'Iniciar sesion'
            : mode === 'register'
              ? 'Crear cuenta'
              : 'Enviar enlace'}
      </button>

      <div className="text-center text-sm text-gray-500">
        {mode === 'login' && (
          <>
            <Link href="/es/auth/recuperar" className="hover:text-stone-700 underline">
              Olvidaste tu contrasena?
            </Link>
            <span className="mx-2">|</span>
            <Link href="/es/auth/registro" className="hover:text-stone-700 underline">
              Crear cuenta
            </Link>
          </>
        )}
        {mode === 'register' && (
          <span>
            Ya tienes cuenta?{' '}
            <Link href="/es/auth/login" className="hover:text-stone-700 underline">
              Iniciar sesion
            </Link>
          </span>
        )}
        {mode === 'recover' && (
          <Link href="/es/auth/login" className="hover:text-stone-700 underline">
            Volver al inicio de sesion
          </Link>
        )}
      </div>
    </form>
  )
}
