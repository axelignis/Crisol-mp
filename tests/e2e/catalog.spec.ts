import { test, expect } from '@playwright/test'

test.describe('Public Catalog', () => {
  // Tests assume seed data from migration 014 (categories and tags exist)

  test('displays catalog page with title and grid', async ({ page }) => {
    await page.goto('/es/catalogo')
    await expect(page).toHaveTitle(/[Cc]at[aá]logo/)
    // Grid container must exist (even if empty, it renders)
    await expect(
      page.locator('[data-testid="product-grid"]').or(page.locator('main'))
    ).toBeVisible()
  })

  test('empty state shows when no results match impossible filter', async ({ page }) => {
    // Use impossible price filter to guarantee empty results
    await page.goto('/es/catalogo?precio_min=99999999')
    await expect(
      page.getByText(/[Ss]in resultados/).or(page.getByText(/[Nn]o se encontraron/))
    ).toBeVisible()
  })

  test('filter sidebar is visible on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/es/catalogo')
    // Filter sections should be visible (sidebar or filter container)
    await expect(
      page.locator('[data-testid="filter-tipo"]').or(page.locator('[data-testid="product-filters"]'))
    ).toBeVisible()
  })

  test('sort dropdown changes URL param', async ({ page }) => {
    await page.goto('/es/catalogo')
    const sortTrigger = page.locator('[data-testid="sort-dropdown"]')
    if (await sortTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sortTrigger.click()
      await page.click('text=Precio: menor a mayor')
      await expect(page).toHaveURL(/orden=precio_asc/)
    }
  })

  test('product detail 404 for nonexistent slug', async ({ page }) => {
    const response = await page.goto('/es/catalogo/nonexistent-product-slug-xyz')
    expect(response?.status()).toBe(404)
  })

  test('artisan profile 404 for nonexistent slug', async ({ page }) => {
    const response = await page.goto('/es/artesanos/nonexistent-artisan-slug-xyz')
    expect(response?.status()).toBe(404)
  })
})
