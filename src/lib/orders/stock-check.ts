/**
 * Phase 3 Plan 05 — Stock revalidation con row-level lock.
 *
 * Wrapper sobre la RPC `decrement_stock_atomic` (migracion 018) que aplica
 * `SELECT ... FOR UPDATE` por variante y decrementa atomicamente solo si hay
 * stock suficiente. Devuelve la lista de filas insuficientes para que el
 * webhook decida (refund vs flag de reconciliacion).
 *
 * Mitiga T-03-20 (oversell concurrente).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type StockCheckItem = { variantId: string; qty: number }

export type StockCheckRow = {
  variant_id: string
  available: number
  requested: number
  ok: boolean
}

export type StockCheckResult = {
  ok: boolean
  rows: StockCheckRow[]
  insufficient: StockCheckRow[]
}

export async function revalidateStockWithLock(
  supabase: SupabaseClient,
  items: StockCheckItem[],
): Promise<StockCheckResult> {
  const { data, error } = await supabase.rpc('decrement_stock_atomic', {
    p_items: items as unknown as object,
  })
  if (error) {
    throw new Error(`revalidateStockWithLock: rpc error: ${error.message}`)
  }
  const rows = (data ?? []) as StockCheckRow[]
  const insufficient = rows.filter((r) => !r.ok)
  return { ok: insufficient.length === 0, rows, insufficient }
}
