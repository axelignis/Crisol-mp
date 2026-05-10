import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001'

// Si PLAYWRIGHT_WEBSERVER=1, Playwright arrancará `pnpm dev` automáticamente.
// Por defecto se asume que el dev server lo levanta el desarrollador (compat con flujo previo).
const useWebServer = process.env.PLAYWRIGHT_WEBSERVER === '1'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(useWebServer
    ? {
        webServer: {
          command: 'pnpm dev',
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
})
