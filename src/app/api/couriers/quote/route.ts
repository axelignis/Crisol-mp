import { NextResponse } from 'next/server'
import { z } from 'zod'
import { quoteForCart } from '@/lib/couriers'

const addressSchema = z.object({
  region: z.string().min(1),
  comuna: z.string().min(1),
  postalCode: z.string().optional(),
})

const packageSchema = z.object({
  weightKg: z.number().positive(),
  lengthCm: z.number().positive(),
  widthCm: z.number().positive(),
  heightCm: z.number().positive(),
})

const schema = z.object({
  destination: addressSchema.extend({
    countryCode: z.literal('CL'),
  }),
  groups: z
    .array(
      z.object({
        artisanId: z.string().uuid(),
        origin: addressSchema,
        package: packageSchema,
      }),
    )
    .min(1)
    .max(10),
  preferredCourier: z.enum(['chilexpress', 'starken']).optional(),
})

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_json' },
      { status: 400 },
    )
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const result = await quoteForCart(parsed.data)
    return NextResponse.json(result)
  } catch (e) {
    const message = (e as Error).message ?? ''
    if (message.startsWith('CL_ONLY')) {
      return NextResponse.json(
        { error: 'cl_only', message: 'Solo envíos a Chile en esta versión' },
        { status: 400 },
      )
    }
    console.error('[api/couriers/quote] server_error', message)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
