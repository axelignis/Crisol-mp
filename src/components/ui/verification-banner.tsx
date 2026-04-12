'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

export function VerificationBanner() {
  const searchParams = useSearchParams()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || searchParams.get('verified') !== 'false') {
    return null
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm text-center py-2 px-4 flex items-center justify-center gap-2">
      <span>Verifica tu email para comprar. Revisa tu bandeja de entrada.</span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 text-amber-600 hover:text-amber-900 font-medium"
        aria-label="Cerrar"
      >
        &times;
      </button>
    </div>
  )
}
