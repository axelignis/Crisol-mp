import Image from 'next/image'
import { Camera, Globe, User } from 'lucide-react'
import type { ArtisanProfile } from '@/types/catalog.types'

interface ArtisanProfileHeaderProps {
  artisan: ArtisanProfile
}

export function ArtisanProfileHeader({ artisan }: ArtisanProfileHeaderProps) {
  const name = artisan.user.full_name ?? 'Artesano'

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      {/* Photo */}
      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-full bg-zinc-200">
        {artisan.photo_url ? (
          <Image
            src={artisan.photo_url}
            alt={name}
            fill
            className="object-cover"
            sizes="96px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <User className="h-10 w-10 text-zinc-400" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col items-center gap-2 sm:items-start">
        <h1 className="text-3xl font-semibold text-zinc-900">{name}</h1>

        {artisan.bio && (
          <p className="max-w-xl text-base text-zinc-700 line-clamp-3">
            {artisan.bio}
          </p>
        )}

        {/* Social links */}
        <div className="flex gap-3 mt-1">
          {artisan.instagram && (
            <a
              href={artisan.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Instagram"
            >
              <Camera className="h-5 w-5" />
            </a>
          )}
          {artisan.website && (
            <a
              href={artisan.website}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Sitio web"
            >
              <Globe className="h-5 w-5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
