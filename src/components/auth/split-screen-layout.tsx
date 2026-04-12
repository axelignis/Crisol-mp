'use client'

interface SplitScreenLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export function SplitScreenLayout({ children, title, subtitle }: SplitScreenLayoutProps) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side: hero image + brand */}
      <div className="hidden lg:flex flex-col justify-center items-center bg-stone-900 text-white p-12">
        <div className="max-w-md text-center space-y-6">
          <h1 className="text-4xl font-serif tracking-tight">Crisol</h1>
          <p className="text-lg text-stone-300">
            Joyeria artesanal unica, creada a mano por artesanos independientes
          </p>
          <div className="w-24 h-px bg-stone-600 mx-auto" />
          <p className="text-sm text-stone-400">
            Cada pieza cuenta una historia
          </p>
        </div>
      </div>
      {/* Right side: auth form */}
      <div className="flex flex-col justify-center items-center p-8 lg:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
