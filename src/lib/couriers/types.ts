export type QuoteSource = 'chilexpress' | 'starken' | 'flat_rate'

export type QuoteAddress = {
  region: string
  comuna: string
  postalCode?: string
}

export type QuoteDestination = QuoteAddress & { countryCode: 'CL' | string }

export type QuotePackage = {
  weightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

export type QuoteParams = {
  origin: QuoteAddress
  destination: QuoteDestination
  package: QuotePackage
}

export type QuoteResult = {
  source: QuoteSource
  costClp: number
  etaDays?: number
  serviceCode?: string
  warning?: string
}

export type CartArtisanGroup = {
  artisanId: string
  origin: QuoteAddress
  package: QuotePackage
}

export type QuoteForCartInput = {
  destination: QuoteDestination
  groups: CartArtisanGroup[]
  preferredCourier?: 'chilexpress' | 'starken'
}

export type QuoteForCartResult = {
  quotes: Array<{ artisanId: string; quote: QuoteResult }>
}

export type CourierName = 'chilexpress' | 'starken'

export type CourierAdapter = (params: QuoteParams) => Promise<QuoteResult>
