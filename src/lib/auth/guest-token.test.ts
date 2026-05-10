/**
 * Phase 3 Plan 06 — Guest token (HMAC) tests.
 *
 * sign/verify roundtrip + tampering / wrong secret / malformed rejected.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { signGuestToken, verifyGuestToken } from './guest-token'

const ORDER_ID = '11111111-2222-3333-4444-555555555555'
const EMAIL = 'guest@example.com'
const ORIGINAL_SECRET = process.env.GUEST_TOKEN_SECRET

describe('guest-token', () => {
  beforeEach(() => {
    process.env.GUEST_TOKEN_SECRET = 'test-secret-for-guest-token-aaaaaaaaaaaaaaaa'
  })

  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.GUEST_TOKEN_SECRET
    else process.env.GUEST_TOKEN_SECRET = ORIGINAL_SECRET
  })

  it('roundtrip: sign then verify recovers orderId + lowercase email', () => {
    const token = signGuestToken(ORDER_ID, 'GUEST@Example.com')
    const parsed = verifyGuestToken(token)
    expect(parsed).not.toBeNull()
    expect(parsed!.orderId).toBe(ORDER_ID)
    expect(parsed!.email).toBe('guest@example.com')
  })

  it('returns non-empty base64url string', () => {
    const token = signGuestToken(ORDER_ID, EMAIL)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token.length).toBeGreaterThan(20)
  })

  it('tampered token (mutated payload) returns null', () => {
    const token = signGuestToken(ORDER_ID, EMAIL)
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const tampered = decoded.replace(EMAIL, 'attacker@evil.com')
    const tamperedToken = Buffer.from(tampered, 'utf8').toString('base64url')
    expect(verifyGuestToken(tamperedToken)).toBeNull()
  })

  it('tampered signature returns null', () => {
    const token = signGuestToken(ORDER_ID, EMAIL)
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const lastDot = decoded.lastIndexOf('.')
    const payload = decoded.slice(0, lastDot)
    // Replace signature with all zeros (same length)
    const fakeSig = '0'.repeat(decoded.length - lastDot - 1)
    const bad = Buffer.from(`${payload}.${fakeSig}`, 'utf8').toString('base64url')
    expect(verifyGuestToken(bad)).toBeNull()
  })

  it('token signed with different secret returns null', () => {
    const token = signGuestToken(ORDER_ID, EMAIL)
    process.env.GUEST_TOKEN_SECRET = 'different-secret-bbbbbbbbbbbbbbbbbbbbbbbb'
    expect(verifyGuestToken(token)).toBeNull()
  })

  it('malformed token (not base64) returns null', () => {
    expect(verifyGuestToken('!!!!not-base64!!!!')).toBeNull()
  })

  it('empty token returns null', () => {
    expect(verifyGuestToken('')).toBeNull()
  })

  it('token without separator returns null', () => {
    const bad = Buffer.from('no-dot-here', 'utf8').toString('base64url')
    expect(verifyGuestToken(bad)).toBeNull()
  })
})
