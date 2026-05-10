import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock del facade antes de importar la route
vi.mock('@/lib/couriers', () => ({
  quoteForCart: vi.fn(),
}))

import { POST } from './route'
import { quoteForCart } from '@/lib/couriers'

const validBody = {
  destination: {
    region: 'valparaiso',
    comuna: 'vina-del-mar',
    countryCode: 'CL' as const,
  },
  groups: [
    {
      artisanId: '11111111-1111-1111-1111-111111111111',
      origin: { region: 'metropolitana', comuna: 'santiago' },
      package: { weightKg: 1, lengthCm: 20, widthCm: 15, heightCm: 10 },
    },
  ],
}

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/couriers/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/couriers/quote', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.mocked(quoteForCart).mockReset()
  })

  it('200 con body válido + groups mockeados', async () => {
    vi.mocked(quoteForCart).mockResolvedValue({
      quotes: [
        {
          artisanId: '11111111-1111-1111-1111-111111111111',
          quote: { source: 'chilexpress', costClp: 5500, etaDays: 3 },
        },
      ],
    })
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.quotes).toHaveLength(1)
    expect(json.quotes[0].quote.source).toBe('chilexpress')
  })

  it('400 cuando countryCode = US (Zod literal CL)', async () => {
    const res = await POST(
      makeReq({
        ...validBody,
        destination: { ...validBody.destination, countryCode: 'US' },
      }),
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('invalid_input')
  })

  it('400 cuando groups está vacío', async () => {
    const res = await POST(makeReq({ ...validBody, groups: [] }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('invalid_input')
  })

  it('400 con dimensiones negativas', async () => {
    const res = await POST(
      makeReq({
        ...validBody,
        groups: [
          {
            ...validBody.groups[0],
            package: { weightKg: -1, lengthCm: 20, widthCm: 15, heightCm: 10 },
          },
        ],
      }),
    )
    expect(res.status).toBe(400)
  })

  it('400 cuando JSON está mal formado', async () => {
    const res = await POST(makeReq('{not json'))
    expect(res.status).toBe(400)
  })

  it('400 con groups.length > 10', async () => {
    const tooMany = Array.from({ length: 11 }, () => validBody.groups[0])
    const res = await POST(makeReq({ ...validBody, groups: tooMany }))
    expect(res.status).toBe(400)
  })

  it('400 con artisanId no-UUID', async () => {
    const res = await POST(
      makeReq({
        ...validBody,
        groups: [{ ...validBody.groups[0], artisanId: 'not-a-uuid' }],
      }),
    )
    expect(res.status).toBe(400)
  })

  it('400 cuando facade lanza CL_ONLY (defensa en profundidad)', async () => {
    vi.mocked(quoteForCart).mockRejectedValue(
      new Error('CL_ONLY: Solo envíos a Chile en esta versión'),
    )
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('cl_only')
  })

  it('500 cuando facade lanza error inesperado', async () => {
    vi.mocked(quoteForCart).mockRejectedValue(new Error('boom'))
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('server_error')
  })
})
