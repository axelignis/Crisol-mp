import { test, expect } from '@playwright/test'

const ARTISAN_EMAIL = process.env.TEST_ARTISAN_EMAIL ?? 'artisan@test.crisol.cl'
const ARTISAN_PASSWORD = process.env.TEST_ARTISAN_PASSWORD ?? 'TestPassword123!'

test.describe('Piece Creation Wizard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to auth and log in as artisan test user
    await page.goto('/es/auth/login')
    await page.fill('#email', ARTISAN_EMAIL)
    await page.fill('#password', ARTISAN_PASSWORD)
    await page.click('button[type="submit"]')
    // Login redirige a /es (homepage). Esperar a que la sesion este activa
    // verificando salida de /auth/login.
    await page.waitForURL((url) => !/auth\/login/.test(url.toString()), {
      timeout: 10000,
    })
  })

  test('create piece happy path - step 1 fills and advances', async ({ page }) => {
    await page.goto('/artesano/piezas/nueva')

    // Step 1: Fill basic info
    // Radix Select (combobox custom): click trigger, luego click option.
    const typeSelect = page.locator('[data-testid="piece-type"]')
    if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeSelect.click()
      await page.getByRole('option', { name: 'Pieza unica' }).click()
    }

    await page.fill('[data-testid="piece-title"]', 'Anillo de prueba E2E')
    await page.fill('[data-testid="piece-description"]', 'Descripcion de pieza de prueba para E2E')
    await page.fill('[data-testid="piece-price"]', '50000')
    await page.click('button:has-text("Siguiente")')

    // Should auto-save and advance to step 2
    await expect(
      page.getByText(/[Gg]uardado/).or(page.getByText(/[Vv]ariantes/)).or(page.getByText(/[Pp]aso 2/))
    ).toBeVisible({ timeout: 5000 })
  })

  test('validation error - title too short prevents advance', async ({ page }) => {
    await page.goto('/artesano/piezas/nueva')

    // Radix Select (combobox custom): click trigger, luego click option.
    const typeSelect = page.locator('[data-testid="piece-type"]')
    if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeSelect.click()
      await page.getByRole('option', { name: 'Pieza unica' }).click()
    }

    await page.fill('[data-testid="piece-title"]', 'AB') // Too short (min 3)
    await page.fill('[data-testid="piece-price"]', '50000')
    await page.click('button:has-text("Siguiente")')

    // Should show validation error, NOT advance to step 2
    await expect(
      page.getByText(/[Mm][ií]nimo 3 caracteres/),
    ).toBeVisible({ timeout: 5000 })
  })

  test('wizard page loads correctly for artisan user', async ({ page }) => {
    await page.goto('/artesano/piezas/nueva')
    // Page must render the wizard form or at least the page content
    await expect(
      page.locator('[data-testid="piece-wizard"]'),
    ).toBeVisible()
  })

  test('piece list page loads for artisan', async ({ page }) => {
    await page.goto('/artesano/piezas')
    await expect(page.locator('main')).toBeVisible()
  })
})
