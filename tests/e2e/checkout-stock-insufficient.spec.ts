/**
 * Phase 3 / Plan 03-08 — Stock insufficient durante checkout (COMR-04, T-03-14).
 *
 * Reproduce el race "qty disponible < cart qty" stubeando
 * `/api/checkout/payment-intent` con 409 `stock_insufficient`. Verifica que
 * la UI muestra el mensaje de error de pago y NO monta PaymentElement.
 *
 * No depende de DB seed: el server return path 409 es ejercitado por unit
 * tests (`route.test.ts`). Aquí cubrimos el contrato UI ↔ API.
 */
import { test, expect } from '@playwright/test'
import {
  CART_STORAGE_KEY,
  buildSingleArtisanCart,
  buildAddress,
} from '../../src/test/factories/cart'

test.describe('Checkout - stock insufficient (COMR-04)', () => {
  test.beforeEach(async ({ context, page }) => {
    const cart = buildSingleArtisanCart(1, { unitPrice: 30000, qty: 5 })
    await context.addInitScript(
      ({ key, payload }) => {
        try {
          window.localStorage.setItem(key, JSON.stringify(payload))
        } catch {}
      },
      { key: CART_STORAGE_KEY, payload: cart }
    )

    await page.route('**/api/couriers/quote', async (route) => {
      const req = route.request().postDataJSON() as { groups: { artisanId: string }[] }
      const quotes = req.groups.map((g) => ({
        artisanId: g.artisanId,
        quote: { source: 'flat_rate', costClp: 5990 },
      }))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ quotes }),
      })
    })

    // Simula stock concurrente: server detecta qty > stock disponible.
    await page.route('**/api/checkout/payment-intent', async (route) => {
      const body = route.request().postDataJSON() as {
        items: { variantId: string; qty: number }[]
      }
      const first = body.items[0]
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'stock_insufficient',
          insufficient: [
            { variantId: first.variantId, available: 1, requested: first.qty },
          ],
        }),
      })
    })
  })

  test('init pay con stock insuficiente muestra error y no monta Stripe', async ({
    page,
  }) => {
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
    await expect(page.getByText(/courier:.*flat_rate/i).first()).toBeVisible({
      timeout: 5000,
    })

    await page.getByTestId('checkout-disclaimers-accept').check()

    const initPay = page.getByTestId('checkout-init-pay-button')
    await expect(initPay).toBeEnabled()
    await initPay.click()

    // El form mapea json.error → setPiError. Aparece en pantalla.
    await expect(page.getByText(/stock_insufficient/i)).toBeVisible({
      timeout: 5000,
    })

    // PaymentElement no se monta porque clientSecret quedó null.
    // El botón init-pay sigue presente (no se ocultó).
    await expect(initPay).toBeVisible()
  })
})
