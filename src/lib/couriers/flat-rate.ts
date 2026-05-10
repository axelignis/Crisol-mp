import type { QuoteParams, QuoteResult } from './types'

/**
 * Tarifa plana de fallback por región (CLP).
 * Hard-coded en Phase 3; movible a tabla `config` en Phase 4.
 * Keys = región normalizada (slug sin tildes, lowercase).
 */
export const FLAT_RATES_BY_REGION: Record<string, number> = {
  metropolitana: 4990,
  valparaiso: 5990,
  ohiggins: 6490,
  maule: 6990,
  biobio: 6990,
  nuble: 6990,
  araucania: 7490,
  loslagos: 7990,
  losrios: 7990,
  arica: 8990,
  tarapaca: 8990,
  antofagasta: 7990,
  atacama: 7490,
  coquimbo: 6490,
  aysen: 9990,
  magallanes: 9990,
  default: 7990,
}

const DEFAULT_ETA_DAYS = 5

function normalizeRegion(region: string): string {
  return region
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function flatRateFallback(params: QuoteParams): QuoteResult {
  const key = normalizeRegion(params.destination.region)
  const cost =
    FLAT_RATES_BY_REGION[key] ?? FLAT_RATES_BY_REGION.default

  return {
    source: 'flat_rate',
    costClp: cost,
    etaDays: DEFAULT_ETA_DAYS,
  }
}
