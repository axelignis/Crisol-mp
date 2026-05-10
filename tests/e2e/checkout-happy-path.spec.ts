/**
 * Phase 3 / Plan 03-07 — Checkout happy path (multi-artisan).
 *
 * Cubre el flujo end-to-end UI: carrito multi-artesano → checkout →
 * cotización envío → cupón vacío → disclaimers → init payment-intent.
 *
 * Por qué stubeamos /api/checkout/payment-intent y /api/couriers/quote:
 *   - Evita dependencia de Stripe live + DB seed específica.
 *   - El happy path de UI es ejercitado completamente.
 *   - Webhook idempotency cubre el lado server (ver webhook-idempotency.spec.ts).
 *
 * Lo que no cubre (out-of-scope, ver `webhook-idempotency.spec.ts` y manual QA):
 *   - Render real del PaymentElement de Stripe (requiere clientSecret válido firmado por Stripe).
 *   - Confirmación post-redirect a /checkout/confirmacion.
 */
import { test, expect } from '@playwright/test'
import {
  CART_STORAGE_KEY,
  buildMultiArtisanCart,
  buildAddress,
  calcSubtotal,
} from '../../src/test/factories/cart'

test.describe('Checkout - happy path (multi-artisan)', () => {
  let cart: ReturnType<typeof buildMultiArtisanCart>

  test.beforeEach(async ({ context, page }) => {
    cart = buildMultiArtisanCart()
    await context.addInitScript(
      ({ key, payload }) => {
        try {
          window.localStorage.setItem(key, JSON.stringify(payload))
        } catch {}
      },
      { key: CART_STORAGE_KEY, payload: cart }
    )

    // Stub courier quote.
    await page.route('**/api/couriers/quote', async (route) => {
      const req = route.request().postDataJSON() as { groups: { artisanId: string }[] }
      const quotes = req.groups.map((g) => ({
        artisanId: g.artisanId,
        quote: { source: 'chilexpress', costClp: 4990 },
      }))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ quotes }),
      })
    })

    // Stub payment-intent endpoint para evitar dependencia de Supabase live.
    await page.route('**/api/checkout/payment-intent', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          clientSecret: 'pi_test_secret_' + Math.random().toString(36).slice(2),
          snapshotId: '11111111-2222-3333-4444-555555555555',
        }),
      })
    })
  })

  test('UI flow: cart → checkout → quote → disclaimers → init pay', async ({ page }) => {
    // 1. Visitar carrito y verificar 2 artesanos.
    await page.goto('/es/carrito')
    await expect(page.locator('[data-testid="cart-artisan-group"]')).toHaveCount(2)

    // Subtotal esperado por factory.
    const subtotal = calcSubtotal(cart)
    expect(subtotal).toBeGreaterThan(0)

    // 2. Goto checkout directamente (route compartida).
    await page.goto('/es/checkout')

    // 3. Llenar email + dirección.
    const addr = buildAddress()
    await page.locator('input[type="email"]').first().fill(`buyer+${Date.now()}@example.com`)
    await page.getByLabel('Nombre completo').fill(addr.fullName)
    await page.getByPlaceholder(/calle y numero/i).fill(addr.line1)
    await page.getByPlaceholder(/^comuna$/i).fill(addr.city)
    await page.getByPlaceholder(/^region$/i).fill(addr.region)

    // 4. Cotizar envío (stub responde con chilexpress).
    await page.getByRole('button', { name: /cotizar envio/i }).click()
    await expect(page.getByText(/courier:.*chilexpress/i).first()).toBeVisible({ timeout: 5000 })

    // 5. Aceptar disclaimers.
    await page.getByTestId('checkout-disclaimers-accept').check()

    // 6. Click iniciar pago (init pay button).
    const initPay = page.getByTestId('checkout-init-pay-button')
    await expect(initPay).toBeEnabled({ timeout: 5000 })
    await initPay.click()

    // 7. Tras stub de payment-intent, el componente intenta montar Stripe Elements.
    //    Verificar que pasamos del init y se invocó nuestro stub
    //    (el botón init desaparece porque clientSecret pasa a no-null).
    //    En este punto Stripe.js intentará cargar; aceptamos cualquiera de los
    //    dos estados como "init triggered exitoso".
    const initPayGone = await initPay
      .waitFor({ state: 'detached', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    expect(initPayGone).toBe(true)
  })
})
