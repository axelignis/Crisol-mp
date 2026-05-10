/**
 * Phase 3 Plan 06 — Guest token (HMAC-SHA256).
 *
 * Permite a un comprador invitado (sin sesion) acceder a su orden via
 * `/pedido/{orderId}?token=...`. El token es firmado con `GUEST_TOKEN_SECRET`
 * sobre `${orderId}:${email.toLowerCase()}`. La verificacion usa
 * `timingSafeEqual` para evitar leakage por timing.
 *
 * Mitigaciones threat model:
 *  - T-03-23 (Information Disclosure / IDOR): solo el holder del token valido
 *    puede ver la orden (verify exige orderId y email del payload).
 *  - T-03-24 (Tampering / forgery): HMAC-SHA256 con secret server-only.
 *
 * Email PII en token (T-03-25): aceptado — el email ya esta en URL del receptor.
 */
import crypto from 'crypto'

function getSecret(): string {
  const s = process.env.GUEST_TOKEN_SECRET
  if (!s) {
    throw new Error(
      '[guest-token] GUEST_TOKEN_SECRET no esta definida. Configurar en .env.local (dev) o Vercel env vars (prod). Server-only.',
    )
  }
  return s
}

export function signGuestToken(orderId: string, email: string): string {
  const payload = `${orderId}:${email.toLowerCase()}`
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}.${sig}`, 'utf8').toString('base64url')
}

export function verifyGuestToken(token: string): { orderId: string; email: string } | null {
  if (!token || typeof token !== 'string') return null
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const lastDot = decoded.lastIndexOf('.')
    if (lastDot <= 0) return null
    const payload = decoded.slice(0, lastDot)
    const sig = decoded.slice(lastDot + 1)
    if (!sig || !payload) return null

    const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
    const sigBuf = Buffer.from(sig, 'hex')
    const expBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expBuf.length) return null
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null

    const sep = payload.indexOf(':')
    if (sep <= 0) return null
    const orderId = payload.slice(0, sep)
    const email = payload.slice(sep + 1)
    if (!orderId || !email) return null
    return { orderId, email }
  } catch {
    return null
  }
}
