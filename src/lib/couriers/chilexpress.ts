import type { QuoteParams, QuoteResult } from './types'

/**
 * Adapter Chilexpress.
 *
 * TODO(verify-sandbox): URL/payload exactos pendientes de validar contra
 * el portal https://developers.wschilexpress.com/ — research dice MEDIUM
 * confidence. Si las creds no están disponibles, lanza error y `quote()`
 * cae a flat_rate. AbortSignal.timeout(4500) deja margen sub-5s frente al
 * timeout del facade.
 *
 * Manual verify (cuando creds disponibles):
 *   curl -X POST https://testservices.wschilexpress.com/rating/api/v1.0/rates/courier \\
 *     -H 'Content-Type: application/json' \\
 *     -H 'Ocp-Apim-Subscription-Key: $CHILEXPRESS_API_KEY' \\
 *     -d '{ "originCountyCode":"STGO", "destinationCountyCode":"VLPO", "package":{...} }'
 */
export async function quoteChilexpress(
  params: QuoteParams,
): Promise<QuoteResult> {
  const apiKey = process.env.CHILEXPRESS_API_KEY
  const codCuenta = process.env.CHILEXPRESS_COD_CUENTA
  if (!apiKey || !codCuenta) {
    throw new Error('CHILEXPRESS_ENV_MISSING')
  }

  const url =
    'https://testservices.wschilexpress.com/rating/api/v1.0/rates/courier'

  const body = {
    originCountyCode: params.origin.comuna,
    destinationCountyCode: params.destination.comuna,
    package: {
      weight: params.package.weightKg.toString(),
      height: params.package.heightCm.toString(),
      width: params.package.widthCm.toString(),
      length: params.package.lengthCm.toString(),
    },
    productType: 3,
    contentType: 1,
    declaredWorth: '1000',
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4500),
  })

  if (!res.ok) {
    throw new Error(`CHILEXPRESS_HTTP_${res.status}`)
  }

  const json = (await res.json()) as {
    data?: {
      courierServiceOptions?: Array<{
        serviceTypeCode?: string
        serviceValue?: number
        deliveryDays?: number
      }>
    }
  }

  const opt = json?.data?.courierServiceOptions?.[0]
  if (!opt || typeof opt.serviceValue !== 'number') {
    throw new Error('CHILEXPRESS_EMPTY_RESPONSE')
  }

  return {
    source: 'chilexpress',
    costClp: Math.round(opt.serviceValue),
    etaDays: opt.deliveryDays,
    serviceCode: opt.serviceTypeCode,
  }
}
