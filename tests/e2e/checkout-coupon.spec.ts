/**
 * Phase 3 / Plan 03-07 — Checkout cupón (COUP-02, COUP-03).
 *
 * Cubre 5 casos: válido, expirado, inexistente, min_order, remove.
 *
 * Estrategia: stubeamos /api/checkout/coupon (preview endpoint, NO incrementa
 * uses_count) para no depender de DB seed. La validación real del endpoint
 * está en `src/lib/checkout/coupon` con tests unitarios. Aquí verificamos
 * que el componente UI mapea cada `reason` al mensaje correcto.
 */
import { test, expect, type Route } from '@playwright/test'
import {
  CART_STORAGE_KEY,
  buildSingleArtisanCart,
  calcSubtotal,
} from '../../src/test/factories/cart'
import {
  COUPON_CRISOL10,
  COUPON_BIENVENIDA,
  COUPON_EXPIRADO,
} from '../../src/test/factories/coupon'

type CouponReq = { code: string; subtotal: number }
type CouponRes =
  | { valid: true; discount: number; discountType: 'percentage' | 'fixed' }
  | { valid: false; reason: 'not_found' | 'inactive' | 'expired' | 'limit_reached' | 'min_order' }

function couponHandler(route: Route) {
  const req = route.request().postDataJSON() as CouponReq
  const code = req.code.trim().toUpperCase()
  let res: CouponRes
  if (code === COUPON_CRISOL10.code) {
    res = {
      valid: true,
      discount: Math.floor((req.subtotal * COUPON_CRISOL10.discount_value) / 100),
      discountType: 'percentage',
    }
  } else if (code === COUPON_BIENVENIDA.code) {
    if (req.subtotal < (COUPON_BIENVENIDA.min_order_clp ?? 0)) {
      res = { valid: false, reason: 'min_order' }
    } else {
      res = { valid: true, discount: COUPON_BIENVENIDA.discount_value, discountType: 'fixed' }
    }
  } else if (code === COUPON_EXPIRADO.code) {
    res = { valid: false, reason: 'expired' }
  } else {
    res = { valid: false, reason: 'not_found' }
  }
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(res),
  })
}

test.describe('Checkout - cupón (COUP-02, COUP-03)', () => {
  test.beforeEach(async ({ context, page }) => {
    await page.route('**/api/checkout/coupon', couponHandler)
  })

  test('CRISOL10 aplica 10% sobre subtotal', async ({ context, page }) => {
    const cart = buildSingleArtisanCart(1, { unitPrice: 50000, qty: 1 })
    const subtotal = calcSubtotal(cart)
    await context.addInitScript(
      ({ key, payload }) => {
        try {
          window.localStorage.setItem(key, JSON.stringify(payload))
        } catch {}
      },
      { key: CART_STORAGE_KEY, payload: cart }
    )
    await page.goto('/es/checkout')

    await page.getByPlaceholder(/ingresa tu codigo/i).fill('CRISOL10')
    await page.getByRole('button', { name: /^aplicar$/i }).click()

    const expectedDiscount = Math.floor(subtotal * 0.1)
    await expect(page.getByText(new RegExp(`CRISOL10 aplicado`, 'i'))).toBeVisible()
    await expect(
      page.getByText(new RegExp(`-?\\$?${expectedDiscount.toLocaleString('es-CL')}`))
    ).toBeVisible()
  })

  test('CRISOL10 → quitar cupón restablece descuento a 0', async ({ context, page }) => {
    const cart = buildSingleArtisanCart(1, { unitPrice: 40000, qty: 1 })
    await context.addInitScript(
      ({ key, payload }) => {
        try {
          window.localStorage.setItem(key, JSON.stringify(payload))
        } catch {}
      },
      { key: CART_STORAGE_KEY, payload: cart }
    )
    await page.goto('/es/checkout')

    await page.getByPlaceholder(/ingresa tu codigo/i).fill('CRISOL10')
    await page.getByRole('button', { name: /^aplicar$/i }).click()
    await expect(page.getByText(/CRISOL10 aplicado/i)).toBeVisible()

    await page.getByRole('button', { name: /quitar cupon/i }).click()
    await expect(page.getByText(/CRISOL10 aplicado/i)).not.toBeVisible()
    // Tras quitar, vuelve el input.
    await expect(page.getByPlaceholder(/ingresa tu codigo/i)).toBeVisible()
  })

  test('EXPIRADO muestra mensaje de expirado', async ({ context, page }) => {
    const cart = buildSingleArtisanCart(1, { unitPrice: 40000, qty: 1 })
    await context.addInitScript(
      ({ key, payload }) => {
        try {
          window.localStorage.setItem(key, JSON.stringify(payload))
        } catch {}
      },
      { key: CART_STORAGE_KEY, payload: cart }
    )
    await page.goto('/es/checkout')

    await page.getByPlaceholder(/ingresa tu codigo/i).fill('EXPIRADO')
    await page.getByRole('button', { name: /^aplicar$/i }).click()

    await expect(page.getByText(/ha expirado/i)).toBeVisible()
    // Sigue sin cupón aplicado.
    await expect(page.getByText(/aplicado/i)).not.toBeVisible()
  })

  test('INEXISTENTE muestra cupón inválido', async ({ context, page }) => {
    const cart = buildSingleArtisanCart(1, { unitPrice: 40000, qty: 1 })
    await context.addInitScript(
      ({ key, payload }) => {
        try {
          window.localStorage.setItem(key, JSON.stringify(payload))
        } catch {}
      },
      { key: CART_STORAGE_KEY, payload: cart }
    )
    await page.goto('/es/checkout')

    await page.getByPlaceholder(/ingresa tu codigo/i).fill('INEXISTENTE')
    await page.getByRole('button', { name: /^aplicar$/i }).click()

    await expect(page.getByText(/cupon invalido/i)).toBeVisible()
  })

  test('BIENVENIDA con cart < 30000 muestra error min_order', async ({ context, page }) => {
    // Cart subtotal por debajo del mínimo.
    const cart = buildSingleArtisanCart(1, { unitPrice: 10000, qty: 1 })
    await context.addInitScript(
      ({ key, payload }) => {
        try {
          window.localStorage.setItem(key, JSON.stringify(payload))
        } catch {}
      },
      { key: CART_STORAGE_KEY, payload: cart }
    )
    await page.goto('/es/checkout')

    await page.getByPlaceholder(/ingresa tu codigo/i).fill('BIENVENIDA')
    await page.getByRole('button', { name: /^aplicar$/i }).click()

    await expect(page.getByText(/pedido minimo de \$30\.000/i)).toBeVisible()
  })
})
