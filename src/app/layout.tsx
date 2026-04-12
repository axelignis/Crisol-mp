import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Crisol',
  description: 'Marketplace de orfebrería artesanal',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
