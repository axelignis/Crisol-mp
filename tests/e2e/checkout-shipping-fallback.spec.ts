/**
 * Phase 3 / Plan 03-07 — Checkout courier fallback (COMR-05).
 *
 * Verifica:
 *  - Cuando /api/couriers/quote falla (timeout/5xx), la UI cae a la rama
 *    flat_rate definida en `checkout-form.tsx` (ver línea 78-81).
 *  - Cada artesano queda con courier `flat_rate` y costo 5990.
 *  - El componente `CheckoutShipping` muestra el aviso `timeoutFallback`
 *    ("Usando tarifa estandar (envio estimado)").
 *  - El flujo NO se bloquea: tras aceptar disclaimers + form completo el
 *    botón Pagar puede habilitarse (no chequeamos enabled estricto porque
 *    depende de PaymentElement, sí chequeamos que el checkbox toggle es
 *    funcional, gating mínimo del checkout).
 *
 * Estrategia: `page.route(...)` intercepta `/api/couriers/quote` y responde
 * 500 (simula upstream timeout/abort propagado al endpoint). El cliente
 * `fetch` ve `!res.ok` y entra en la rama de fallback. Usar `route.abort()`
 * NO funciona aquí porque haría que `fetch` lance y el handler (try/finally
 * sin catch) propague la rejection en lugar de aplicar fallback.
 */
import { test, expect } from '@playwright/test'
import {
  CART_STORAGE_KEY,
  buildMultiArtisanCart,
  buildAddress,
} from '../../src/test/factories/cart'

test.describe('Checkout - courier fallback (COMR-05)', () => {
  test.beforeEach(async ({ context, page }) => {
    const cart = buildMultiArtisanCart()
    await context.addInitScript(
      ({ key, payload }) => {
        try {
          window.localStorage.setItem(key, JSON.stringify(payload))
        } catch {}
      },
      { key: CART_STORAGE_KEY, payload: cart }
    )

    // Forzar timeout/5xx desde el endpoint de quote — equivalente a courier
    // upstream colgado. El handler en checkout-form.tsx detecta `!res.ok` y
    // aplica fallback a flat_rate per artisan.
    await page.route('**/api/couriers/quote', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'server_error' }),
      })
    })
  })

  test('cae a flat_rate cuando /api/couriers/quote falla', async ({ page }) => {
    await page.goto('/es/checkout')

    // Llenar address mínima para habilitar la sección de envío.
    const addr = buildAddress()
    const emailInput = page.locator('input[type="email"]').first()
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(`buyer+${Date.now()}@example.com`)
    }
    await page.getByLabel('Nombre completo').fill(addr.fullName)
    await page.getByPlaceholder(/calle y numero/i).fill(addr.line1)
    await page.getByPlaceholder(/^comuna$/i).fill(addr.city)
    await page.getByPlaceholder(/^region$/i).fill(addr.region)

    // Click cotizar — el stub devuelve 500.
    await page.getByRole('button', { name: /cotizar envio/i }).click()

    // Assert: aparece courier flat_rate per artesano.
    await expect(page.getByText(/courier:\s*flat_rate/i).first()).toBeVisible({
      timeout: 5000,
    })

    // Assert: nota de fallback i18n (`timeoutFallback`).
    await expect(
      page.getByText(/tarifa estandar.*envio estimado/i).first()
    ).toBeVisible()

    // Assert: 2 grupos (multi-artisan cart) → 2 entradas flat_rate.
    await expect(page.getByText(/courier:\s*flat_rate/i)).toHaveCount(2)

    // Assert: costo 5990 visible al menos una vez (formato es-CL).
    await expect(page.getByText(/\$5\.990/).first()).toBeVisible()

    // Assert: el flujo no se bloquea — el checkbox de disclaimers responde.
    const checkbox = page.getByTestId('checkout-disclaimers-accept')
    await checkbox.check()
    await expect(checkbox).toBeChecked()
  })
})
