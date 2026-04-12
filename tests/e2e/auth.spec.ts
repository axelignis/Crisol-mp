import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
)

test.describe('Auth - Registration', () => {
  const testEmails: string[] = []

  test.afterEach(async () => {
    for (const email of testEmails) {
      const { data } = await supabaseAdmin.auth.admin.listUsers()
      const user = data?.users?.find((u) => u.email === email)
      if (user) {
        await supabaseAdmin.auth.admin.deleteUser(user.id)
      }
    }
    testEmails.length = 0
  })

  test('happy path: register with email and password redirects to homepage with verification banner', async ({ page }) => {
    const email = `test-${Date.now()}@example.com`
    testEmails.push(email)
    await page.goto('/es/auth/registro')

    await expect(page.locator('h1, h2').filter({ hasText: 'Crear cuenta' })).toBeVisible()

    await page.fill('#fullName', 'Test User')
    await page.fill('#email', email)
    await page.fill('#password', 'TestPassword123!')

    await page.click('button[type="submit"]')

    await page.waitForURL(/\/es\?verified=false/, { timeout: 10000 })

    await expect(page.locator('text=Verifica tu email')).toBeVisible()
  })

  test('error case: register with short password stays on register page', async ({ page }) => {
    await page.goto('/es/auth/registro')

    await page.fill('#fullName', 'Test User')
    await page.fill('#email', 'not-a-valid-signup@example.com')
    await page.fill('#password', 'short')

    await page.click('button[type="submit"]')

    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 5000 })
    await expect(page).toHaveURL(/registro/)
  })
})

test.describe('Auth - Login', () => {
  test('login page renders with split-screen layout', async ({ page }) => {
    await page.goto('/es/auth/login')

    await expect(page.locator('h1, h2').filter({ hasText: 'Iniciar sesion' })).toBeVisible()

    await expect(page.locator('text=Crisol')).toBeVisible()

    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('error case: login with wrong credentials shows error', async ({ page }) => {
    await page.goto('/es/auth/login')

    await page.fill('#email', 'nonexistent@example.com')
    await page.fill('#password', 'WrongPassword123!')

    await page.click('button[type="submit"]')

    await expect(page.locator('text=Credenciales incorrectas')).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/login/)
  })
})

test.describe('Auth - Password Recovery', () => {
  test('recovery page renders correctly', async ({ page }) => {
    await page.goto('/es/auth/recuperar')

    await expect(page.locator('h1, h2').filter({ hasText: 'Recuperar contrasena' })).toBeVisible()

    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toHaveText('Enviar enlace')

    await expect(page.locator('#password')).not.toBeVisible()
  })
})

test.describe('Auth - Role Guards', () => {
  test('/artesano redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/artesano')

    await page.waitForURL('**/es/auth/login', { timeout: 10000 })
    await expect(page).toHaveURL(/auth\/login/)
  })

  test('/admin redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/admin')

    await page.waitForURL('**/es/auth/login', { timeout: 10000 })
    await expect(page).toHaveURL(/auth\/login/)
  })
})
