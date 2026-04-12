export interface UploadSignature {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder: string
}

export interface UploadResult {
  secure_url: string
  public_id: string
}

export async function getUploadSignature(folder?: string): Promise<UploadSignature> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder: folder ?? 'crisol/products' }),
  })

  if (!res.ok) {
    throw new Error('Failed to get upload signature')
  }

  return res.json()
}

export async function uploadToCloudinary(
  file: File,
  signature: UploadSignature
): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', signature.apiKey)
  formData.append('timestamp', String(signature.timestamp))
  formData.append('signature', signature.signature)
  formData.append('folder', signature.folder)

  const url = `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`

  let res = await fetch(url, { method: 'POST', body: formData })

  // Auto-retry once with fresh signature on Invalid Signature
  if (!res.ok) {
    const errorText = await res.text()
    if (errorText.includes('Invalid Signature')) {
      const freshSig = await getUploadSignature(signature.folder)
      const retryData = new FormData()
      retryData.append('file', file)
      retryData.append('api_key', freshSig.apiKey)
      retryData.append('timestamp', String(freshSig.timestamp))
      retryData.append('signature', freshSig.signature)
      retryData.append('folder', freshSig.folder)

      res = await fetch(url, { method: 'POST', body: retryData })
      if (!res.ok) throw new Error('Upload failed after retry')
    } else {
      throw new Error(`Upload failed: ${errorText}`)
    }
  }

  const data = await res.json()
  return { secure_url: data.secure_url, public_id: data.public_id }
}
