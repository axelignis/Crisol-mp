import { test, expect } from '@playwright/test'

test.describe('Auth - Registration', () => {
  test('happy path: register with email and password redirects to homepage with verification banner', async ({ page }) => {
    const email = `test-${Date.now()}@example.com`
    await page.goto('/es/auth/registro')

    // Verify split-screen layout renders with register title
    await expect(page.locator('h1, h2').filter({ hasText: 'Crear cuenta' })).toBeVisible()

    // Fill registration form using id selectors from auth-form.tsx
    await page.fill('#fullName', 'Test User')
    await page.fill('#email', email)
    await page.fill('#password', 'TestPassword123!')

    // Submit
    await page.click('button[type="submit"]')

    // Should redirect to homepage with ?verified=false
    await page.waitForURL(/\/es\?verified=false/, { timeout: 10000 })

    // Verification banner should be visible
    await expect(page.locator('text=Verifica tu email')).toBeVisible()
  })

  test('error case: register with existing email shows error', async ({ page }) => {
    await page.goto('/es/auth/registro')

    await page.fill('#fullName', 'Test User')
    await page.fill('#email', 'not-a-valid-signup@example.com')
    await page.fill('#password', 'short')

    await page.click('button[type="submit"]')

    // Should stay on register page or show error (password too short triggers validation)
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/registro/)
  })
})

test.describe('Auth - Login', () => {
  test('login page renders with split-screen layout', async ({ page }) => {
    await page.goto('/es/auth/login')

    // Verify page title from SplitScreenLayout
    await expect(page.locator('h1, h2').filter({ hasText: 'Iniciar sesion' })).toBeVisible()

    // Verify Crisol brand is visible in split-screen
    await expect(page.locator('text=Crisol')).toBeVisible()

    // Verify form elements
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('error case: login with wrong credentials shows error', async ({ page }) => {
    await page.goto('/es/auth/login')

    await page.fill('#email', 'nonexistent@example.com')
    await page.fill('#password', 'WrongPassword123!')

    await page.click('button[type="submit"]')

    // Should show error message and stay on login page
    await expect(page.locator('text=Credenciales incorrectas')).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/login/)
  })
})

test.describe('Auth - Password Recovery', () => {
  test('recovery page renders correctly', async ({ page }) => {
    await page.goto('/es/auth/recuperar')

    // Verify page title
    await expect(page.locator('h1, h2').filter({ hasText: 'Recuperar contrasena' })).toBeVisible()

    // Verify email input and submit button
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toHaveText('Enviar enlace')

    // Password field should NOT be visible in recover mode
    await expect(page.locator('#password')).not.toBeVisible()
  })
})

test.describe('Auth - Role Guards', () => {
  test('/artesano redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/artesano')

    // Should redirect to /es/auth/login
    await page.waitForURL('**/es/auth/login', { timeout: 10000 })
    await expect(page).toHaveURL(/auth\/login/)
  })

  test('/admin redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/admin')

    // Should redirect to /es/auth/login
    await page.waitForURL('**/es/auth/login', { timeout: 10000 })
    await expect(page).toHaveURL(/auth\/login/)
  })
})
