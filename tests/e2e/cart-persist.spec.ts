import { test, expect } from '@playwright/test'

// Phase 3 / Plan 03-02 — Cart persistence + multi-artisan + stock-check API.
// Tests are deterministic: not dependent on seed product data.
// Multi-artisan / persist behavior is exercised by injecting cart state into
// localStorage directly (D-02: persist key 'crisol.cart.v1'), then verifying
// the UI/store rebuilds the same items after reload.

const CART_KEY = 'crisol.cart.v1'

const sampleCart = {
  state: {
    items: [
      {
        productId: '11111111-1111-1111-1111-111111111111',
        variantId: '22222222-2222-2222-2222-222222222222',
        artisanId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        artisanName: 'Artesana A',
        title: 'Aro de plata',
        unitPrice: 25000,
        qty: 2,
      },
      {
        productId: '33333333-3333-3333-3333-333333333333',
        variantId: '44444444-4444-4444-4444-444444444444',
        artisanId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        artisanName: 'Artesano B',
        title: 'Anillo de cobre',
        unitPrice: 18000,
        qty: 1,
      },
    ],
  },
  version: 1,
}

test.describe('Cart - persistence and multi-artisan', () => {
  test.beforeEach(async ({ context }) => {
    // Seed localStorage before any page loads via init script.
    await context.addInitScript(
      ({ key, payload }) => {
        try {
          window.localStorage.setItem(key, JSON.stringify(payload))
        } catch {}
      },
      { key: CART_KEY, payload: sampleCart }
    )
  })

  test('cart page shows two artisan groups and correct subtotal', async ({ page }) => {
    await page.goto('/es/carrito')

    const groups = page.locator('[data-testid="cart-artisan-group"]')
    await expect(groups).toHaveCount(2)

    // Subtotal: 2 * 25000 + 1 * 18000 = 68000 → formatCLP renders "$68.000"
    const subtotal = page.locator('[data-testid="cart-page-subtotal"]')
    await expect(subtotal).toBeVisible()
    await expect(subtotal).toContainText(/68\.?000/)
  })

  test('header badge shows total quantity (3) after hydration', async ({ page }) => {
    await page.goto('/es/catalogo')
    const badge = page.locator('[data-testid="cart-badge-count"]')
    await expect(badge).toBeVisible({ timeout: 5000 })
    await expect(badge).toHaveText('3')
  })

  test('cart persists across reload', async ({ page }) => {
    await page.goto('/es/carrito')
    await expect(
      page.locator('[data-testid="cart-artisan-group"]')
    ).toHaveCount(2)

    await page.reload()
    await expect(
      page.locator('[data-testid="cart-artisan-group"]')
    ).toHaveCount(2)
  })

  test('removing an item updates the cart and persists', async ({ page }) => {
    await page.goto('/es/carrito')
    await expect(
      page.locator('[data-testid="cart-artisan-group"]')
    ).toHaveCount(2)

    // Remove the first item.
    await page
      .locator('[data-testid="cart-item-remove"]')
      .first()
      .click()

    // After removal, expect one group remaining.
    await expect(
      page.locator('[data-testid="cart-artisan-group"]')
    ).toHaveCount(1)

    await page.reload()
    await expect(
      page.locator('[data-testid="cart-artisan-group"]')
    ).toHaveCount(1)
  })
})

test.describe('Cart - empty state', () => {
  test('shows empty CTA when no cart in storage', async ({ page }) => {
    await page.goto('/es/carrito')
    await expect(
      page.getByText(/[Tt]u carrito esta vacio/i)
    ).toBeVisible()
  })
})

test.describe('Cart - stock-check API contract', () => {
  test('rejects payload with non-uuid variantId (400)', async ({ request }) => {
    const res = await request.post('/api/cart/stock-check', {
      data: { items: [{ variantId: 'not-a-uuid', qty: 1 }] },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects payload with qty <= 0 (400)', async ({ request }) => {
    const res = await request.post('/api/cart/stock-check', {
      data: {
        items: [
          { variantId: '00000000-0000-0000-0000-000000000000', qty: 0 },
        ],
      },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects empty items array (400)', async ({ request }) => {
    const res = await request.post('/api/cart/stock-check', { data: { items: [] } })
    expect(res.status()).toBe(400)
  })

  test('returns insufficient for unknown variantId (treated as available=0)', async ({
    request,
  }) => {
    const res = await request.post('/api/cart/stock-check', {
      data: {
        items: [
          { variantId: '00000000-0000-0000-0000-000000000000', qty: 1 },
        ],
      },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(Array.isArray(body.insufficient)).toBe(true)
    expect(body.insufficient[0].available).toBe(0)
    expect(body.insufficient[0].sufficient).toBe(false)
  })
})
