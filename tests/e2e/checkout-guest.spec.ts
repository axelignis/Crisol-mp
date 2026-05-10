/**
 * Phase 3 / Plan 03-07 — Guest checkout flow.
 *
 * Cubre que un visitante sin login puede llenar checkout completo
 * con email guest y avanzar a iniciar pago. Verifica que /checkout
 * NO redirige a /auth/login (guest checkout permitido).
 *
 * Magic-link post-pago se prueba por contrato API (Phase 1 auth) +
 * unit tests de createOrderFromPayment (`route.test.ts`).
 */
import { test, expect } from '@playwright/test'
import {
  CART_STORAGE_KEY,
  buildSingleArtisanCart,
  buildAddress,
} from '../../src/test/factories/cart'

test.describe('Checkout - guest flow', () => {
  test.beforeEach(async ({ context, page }) => {
    const cart = buildSingleArtisanCart(2, { unitPrice: 20000, qty: 1 })
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

    let capturedBody: Record<string, unknown> | null = null
    await page.route('**/api/checkout/payment-intent', async (route) => {
      capturedBody = route.request().postDataJSON() as Record<string, unknown>
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          clientSecret: 'pi_test_secret_' + Math.random().toString(36).slice(2),
          snapshotId: '11111111-2222-3333-4444-555555555555',
        }),
      })
    })
    // expose for assertion
    ;(page as unknown as { __captured?: () => Record<string, unknown> | null }).__captured = () => capturedBody
  })

  test('guest puede completar checkout sin auth y POST incluye buyer_id null', async ({ page }) => {
    await page.goto('/es/checkout')

    // No redirect a /auth/login: estamos en /es/checkout.
    await expect(page).toHaveURL(/\/es\/checkout/)

    const addr = buildAddress()
    const guestEmail = `guest+${Date.now()}@example.com`

    await page.locator('input[type="email"]').first().fill(guestEmail)
    await page.getByLabel('Nombre completo').fill(addr.fullName)
    await page.getByPlaceholder(/calle y numero/i).fill(addr.line1)
    await page.getByPlaceholder(/^comuna$/i).fill(addr.city)
    await page.getByPlaceholder(/^region$/i).fill(addr.region)

    await page.getByRole('button', { name: /cotizar envio/i }).click()
    await expect(page.getByText(/courier:.*flat_rate/i).first()).toBeVisible({ timeout: 5000 })

    await page.getByTestId('checkout-disclaimers-accept').check()

    const initPay = page.getByTestId('checkout-init-pay-button')
    await expect(initPay).toBeEnabled()
    await initPay.click()

    // Verificar que body POST incluye email guest y buyer_id null.
    await expect.poll(() =>
      (page as unknown as { __captured?: () => Record<string, unknown> | null }).__captured?.()
    ).toBeTruthy()
    const body = (page as unknown as { __captured?: () => Record<string, unknown> | null }).__captured?.()
    expect(body).toBeTruthy()
    expect((body as { email: string }).email).toBe(guestEmail)
    expect((body as { buyer_id: string | null }).buyer_id).toBeNull()
    expect((body as { acceptedDisclaimers: boolean }).acceptedDisclaimers).toBe(true)
  })
})
