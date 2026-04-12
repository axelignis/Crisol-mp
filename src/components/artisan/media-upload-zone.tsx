'use client'

import type { MediaFormData } from '@/types/catalog.types'

interface MediaUploadZoneProps {
  productId: string
  initialMedia?: MediaFormData[]
  onChange: (media: MediaFormData[]) => void
}

// Placeholder - fully implemented in Task 3
export function MediaUploadZone({ onChange, initialMedia = [] }: MediaUploadZoneProps) {
  void onChange
  void initialMedia
  return <div>Media upload zone placeholder</div>
}
