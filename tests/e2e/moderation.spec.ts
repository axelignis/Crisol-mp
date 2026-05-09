import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'admin@test.crisol.cl'
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'TestPassword123!'

test.describe('Admin Moderation Queue', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as admin test user
    await page.goto('/es/auth/login')
    await page.fill('#email', ADMIN_EMAIL)
    await page.fill('#password', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/admin/, { timeout: 10000 })
  })

  test('moderation page loads and shows queue or empty state', async ({ page }) => {
    await page.goto('/admin/piezas/revision')
    // Must show either the queue with pieces OR the empty state message
    const queue = page.locator('[data-testid="moderation-queue"]')
    const emptyState = page.getByText(/[Nn]o hay piezas pendientes/)
    await expect(queue.or(emptyState)).toBeVisible({ timeout: 5000 })
  })

  test('approve and reject buttons visible when piece selected', async ({ page }) => {
    await page.goto('/admin/piezas/revision')
    const firstItem = page.locator('[data-testid="moderation-item"]').first()
    if (await firstItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstItem.click()
      await expect(page.getByText(/[Aa]probar/)).toBeVisible()
      await expect(page.getByText(/[Rr]echazar/)).toBeVisible()
    }
  })

  test('moderation page requires admin auth - redirects unauthenticated users', async ({ browser }) => {
    // Use a fresh context (no cookies) to test auth guard
    const context = await browser.newContext()
    const freshPage = await context.newPage()
    await freshPage.goto('/admin/piezas/revision')
    // Should redirect to login
    await expect(freshPage).toHaveURL(/auth|login/, { timeout: 10000 })
    await context.close()
  })
})
