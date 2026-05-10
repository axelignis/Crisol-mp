import type { QuoteParams, QuoteResult } from './types'

/**
 * Adapter Starken.
 *
 * TODO(verify-sandbox): research dice LOW-MEDIUM confidence en URL/payload.
 * Verificar contra documentación oficial de Starken antes de habilitar en
 * prod. Si env vars faltan, lanza error y `quote()` cae a flat_rate.
 *
 * Manual verify:
 *   curl -X POST https://gateway.starken.cl/quote/cotizador \\
 *     -u "$STARKEN_USER:$STARKEN_PASSWORD" \\
 *     -H 'Content-Type: application/json' \\
 *     -d '{ "alto":10, "ancho":15, "largo":20, "kilos":1, "origen":"STGO", "destino":"VLPO", "servicio":"normal" }'
 */
export async function quoteStarken(
  params: QuoteParams,
): Promise<QuoteResult> {
  const user = process.env.STARKEN_USER
  const pass = process.env.STARKEN_PASSWORD
  if (!user || !pass) {
    throw new Error('STARKEN_ENV_MISSING')
  }

  const url = 'https://gateway.starken.cl/quote/cotizador'

  const body = {
    alto: params.package.heightCm,
    ancho: params.package.widthCm,
    largo: params.package.lengthCm,
    kilos: params.package.weightKg,
    origen: params.origin.comuna,
    destino: params.destination.comuna,
    servicio: 'normal',
  }

  const auth = Buffer.from(`${user}:${pass}`).toString('base64')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4500),
  })

  if (!res.ok) {
    throw new Error(`STARKEN_HTTP_${res.status}`)
  }

  const json = (await res.json()) as {
    valor?: number
    dias?: number
    servicio?: string
  }

  if (typeof json?.valor !== 'number') {
    throw new Error('STARKEN_EMPTY_RESPONSE')
  }

  return {
    source: 'starken',
    costClp: Math.round(json.valor),
    etaDays: json.dias,
    serviceCode: json.servicio,
  }
}
