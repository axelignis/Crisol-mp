/**
 * Phase 3 / Plan 03-08 — Couriers per-artisan fan-out (COMR-05).
 *
 * Cart con 2 artesanos → un único POST a /api/couriers/quote con
 * `groups: [a1, a2]`. El stub responde con couriers DISTINTOS por artesano
 * (chilexpress vs starken) para garantizar que la UI mapea cada cotización
 * al grupo correcto y NO mezcla quotes.
 *
 * Cubre:
 *  - Una sola request HTTP a /api/couriers/quote (servidor hace fan-out
 *    internamente vía `quoteForCart` con Promise.all).
 *  - El body del POST incluye exactamente 2 entries en `groups`.
 *  - La UI renderiza ambos couriers, cada uno asociado a su grupo.
 */
import { test, expect } from '@playwright/test'
import {
  CART_STORAGE_KEY,
  buildMultiArtisanCart,
  buildAddress,
} from '../../src/test/factories/cart'

test.describe('Checkout - couriers fan-out per artisan (COMR-05)', () => {
  test('2 artesanos → 1 POST con 2 groups, couriers distintos en UI', async ({
    context,
    page,
  }) => {
    const cart = buildMultiArtisanCart()
    const artisanIds = Array.from(
      new Set(cart.state.items.map((i) => i.artisanId))
    )
    expect(artisanIds.length, 'cart factory genera 2 artesanos').toBe(2)
    const [artisanA, artisanB] = artisanIds

    await context.addInitScript(
      ({ key, payload }) => {
        try {
          window.localStorage.setItem(key, JSON.stringify(payload))
        } catch {}
      },
      { key: CART_STORAGE_KEY, payload: cart }
    )

    let quoteCallCount = 0
    let capturedGroups: { artisanId: string }[] = []

    await page.route('**/api/couriers/quote', async (route) => {
      quoteCallCount += 1
      const req = route.request().postDataJSON() as {
        groups: { artisanId: string }[]
      }
      capturedGroups = req.groups

      // Couriers DISTINTOS por artesano para validar mapping.
      const quotes = req.groups.map((g) => {
        const isFirst = g.artisanId === artisanA
        return {
          artisanId: g.artisanId,
          quote: {
            source: isFirst ? 'chilexpress' : 'starken',
            costClp: isFirst ? 4990 : 6500,
          },
        }
      })

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ quotes }),
      })
    })

    await page.goto('/es/checkout')

    const addr = buildAddress()
    await page
      .locator('input[type="email"]')
      .first()
      .fill(`buyer+${Date.now()}@example.com`)
    await page.getByLabel('Nombre completo').fill(addr.fullName)
    await page.getByPlaceholder(/calle y numero/i).fill(addr.line1)
    await page.getByPlaceholder(/^comuna$/i).fill(addr.city)
    await page.getByPlaceholder(/^region$/i).fill(addr.region)

    await page.getByRole('button', { name: /cotizar envio/i }).click()

    // 1 sola llamada con 2 groups (el server hace el fan-out a couriers).
    await expect.poll(() => quoteCallCount, { timeout: 5000 }).toBe(1)
    expect(capturedGroups.length).toBe(2)
    const sentArtisans = new Set(capturedGroups.map((g) => g.artisanId))
    expect(sentArtisans.has(artisanA)).toBe(true)
    expect(sentArtisans.has(artisanB)).toBe(true)

    // UI muestra ambos couriers — uno chilexpress + uno starken.
    await expect(page.getByText(/courier:.*chilexpress/i)).toHaveCount(1, {
      timeout: 5000,
    })
    await expect(page.getByText(/courier:.*starken/i)).toHaveCount(1)

    // Costos visibles per-artisan.
    await expect(page.getByText(/\$4\.990/).first()).toBeVisible()
    await expect(page.getByText(/\$6\.500/).first()).toBeVisible()
  })
})
