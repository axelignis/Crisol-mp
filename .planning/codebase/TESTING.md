# Testing Patterns

**Analysis Date:** 2026-04-12

## Test Framework

**Runner:**
- Vitest (Unit and Integration tests)
- Playwright (E2E tests)
- Configuration files not yet scaffolded; strategy defined in `docs/testing_strategy.md`

**Assertion Library:**
- Vitest uses standard assertion syntax (comparable to Jest)
- React Testing Library for component assertions
- Playwright assertions for E2E (`expect()`)

**Run Commands:**
```bash
pnpm test                # Run all unit/integration tests
pnpm test:watch         # Watch mode for unit tests
pnpm test:coverage      # Generate coverage report
pnpm test:e2e           # Run Playwright E2E tests
pnpm test:e2e:ui        # Open Playwright UI mode
pnpm test:all           # Run all tests (unit + E2E)
```

See `src/package.json` scripts configuration.

## Test File Organization

**Location:**
- **Unit/Integration tests:** Co-located with source files (same directory)
  - Pattern: `module.test.ts` or `module.spec.ts` alongside `module.ts`
  - Example: `src/lib/utils/commission.test.ts` next to `src/lib/utils/commission.ts`

- **E2E tests:** Centralized in `tests/e2e/` directory
  - Pattern: `<feature>.spec.ts`
  - Examples: `tests/e2e/purchase.spec.ts`, `tests/e2e/publication.spec.ts`, `tests/e2e/auth.spec.ts`

**Naming:**
- Test files: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`
- Test suites: `describe('Module or Feature', () => { ... })`
- Test cases: `it('should [behavior]', () => { ... })`

**Structure:**
```
tests/
└── e2e/
    ├── purchase.spec.ts           # Complete purchase flow
    ├── publication.spec.ts        # Artisan upload → admin approval → public
    ├── auth.spec.ts               # Login, registration, OAuth
    └── loyalty.spec.ts            # Points and membership flows

src/
├── lib/utils/commission.test.ts   # Financial logic
├── lib/utils/coupon.test.ts       # Coupon validation
├── app/api/webhooks/stripe/route.test.ts
├── components/catalog/product-card.test.tsx
└── test/
    ├── setup.ts                   # Vitest global setup
    ├── factories/                 # Mock data factories
    │   ├── product.ts
    │   ├── order.ts
    │   ├── user.ts
    │   └── stripe.ts
    └── utils/
        ├── db.ts                  # Supabase local helpers
        └── auth.ts                # Authentication test helpers
```

## Test Structure

**Vitest Suite Organization:**
```typescript
describe('calculateSplit', () => {
  it('descuenta comisión correcta del total', () => {
    const result = calculateSplit(185000, 10)
    expect(result.commission).toBe(18500)
    expect(result.artisanNet).toBe(166500)
  })

  it('lanza error si commission_pct fuera de rango', () => {
    expect(() => calculateSplit(100000, 55)).toThrow('commission_pct must be between 0 and 50')
  })
})
```

**Setup and Teardown:**
- Global setup: `src/test/setup.ts` (MSW server initialization)
- Per-test setup: Use `beforeEach()` for test data seeding
- Per-test teardown: Use `afterEach()` for cleanup (MSW handlers reset automatically)

## Mocking

**Framework:** 
- MSW (Mock Service Worker) for API mocking
- Vitest `vi.mock()` for module mocking
- Factory functions for test data (not hardcoded fixtures)

**Patterns:**
```typescript
// Mock Stripe webhook
import { createMockStripeEvent } from '@/test/factories/stripe'

const event = createMockStripeEvent('payment_intent.succeeded', {
  id: 'pi_test_123',
  metadata: { order_id: 'order-uuid-123' },
  amount: 18500000, // in cents
})

// Mock Supabase with local DB
const clientAsArtisanA = createSupabaseClient({ 
  role: 'artisan', 
  userId: 'artisan-a' 
})
```

**What to Mock:**
- External APIs: Stripe, Cloudinary, courier APIs, Resend
- Database in unit tests: Use factories; integration tests use local Supabase (`supabase start`)
- Time: `vi.useFakeTimers()` for coupon expiry, order timestamps

**What NOT to Mock:**
- Zod validators (test real validation rules)
- Type guards and utility functions (test logic, not internals)
- RLS policies in integration tests (test with real Supabase local)

## Fixtures and Factories

**Test Data:**
```typescript
// src/test/factories/product.ts
export const mockProduct = (overrides = {}) => ({
  id: crypto.randomUUID(),
  title: 'Anillo test',
  slug: 'anillo-test',
  base_price: 95000,
  currency: 'CLP',
  status: 'published',
  is_unique: false,
  artisan_id: 'artisan-uuid-123',
  created_at: new Date().toISOString(),
  ...overrides,
})

// Usage in tests
const soldProduct = mockProduct({ status: 'sold', price: 185000 })
const draftProduct = mockProduct({ status: 'draft' })
```

**Location:**
- `src/test/factories/` — all mock factories
- Files: `product.ts`, `order.ts`, `user.ts`, `stripe.ts`
- Each factory exports a `mock<Entity>()` function with optional overrides

## Coverage

**Requirements:**
- `src/lib/utils/`: **90%** (pure business logic)
- `src/app/api/`: **80%** (webhook handlers, critical routes)
- `src/components/`: **60%** (UI components, less critical)
- `src/hooks/`: **75%** (shared state hooks)
- **Global project threshold:** **70%** — CI fails if below

**View Coverage:**
```bash
pnpm test:coverage
# HTML report: ./coverage/index.html
# LCOV format: ./coverage/lcov.info
```

## Test Types

**Unit Tests (60% of pyramid):**
- Scope: Single function or utility in isolation
- Example: `calculateSplit()`, `validateCoupon()`, `formatPrice()`
- Dependencies: Mocked or stubbed
- Location: Co-located with source (e.g., `src/lib/utils/commission.test.ts`)

**Integration Tests (30% of pyramid):**
- Scope: API routes with database, hooks with stores, components with API mocking
- Example: `POST /api/webhooks/stripe` receiving webhook, validating signature, updating DB
- Dependencies: Real Supabase local instance, MSW for external APIs
- Location: Co-located (e.g., `src/app/api/webhooks/stripe/route.test.ts`)

**E2E Tests (10% of pyramid, critical flows only):**
- Scope: User journeys across multiple pages
- Example: Browse catalog → Select product → Add to cart → Checkout → Payment → Confirmation
- Dependencies: Full application running, real Stripe test cards
- Location: `tests/e2e/<feature>.spec.ts`
- Run with Playwright across Chrome and Mobile Safari

## Mandatory Test Coverage

**Financial Logic (100% coverage):**
- `src/lib/utils/commission.test.ts`: Split payment calculation, artisan net
- `src/lib/utils/coupon.test.ts`: Coupon validation (expiry, uses, active status)
- `src/lib/utils/points.test.ts`: Points-to-CLP conversion, redemption limits

**Webhook Handlers (100% coverage):**
- `src/app/api/webhooks/stripe/route.test.ts`: Signature verification, idempotency, status updates
- `src/app/api/webhooks/coinbase/route.test.ts`: Same as Stripe

**RLS Policies (100% coverage):**
- `src/test/rls/product.test.ts`: Artisans don't see others' drafts, guests see only published
- `src/test/rls/order.test.ts`: Buyers see only their orders, artisans see customer orders they fulfill

**Critical UI Components:**
- `src/components/catalog/product-card.test.tsx`: Shows sold badge, hides price on sold, shows 3D indicator
- `src/components/checkout/order-summary.test.tsx`: Correct totals (subtotal + shipping + discount)

## Common Patterns

**Async Testing (Vitest):**
```typescript
it('fetches product by slug', async () => {
  const product = await getProductBySlug('anillo-test')
  expect(product?.title).toBe('Anillo test')
})
```

**Error Testing:**
```typescript
it('throws on invalid coupon code', async () => {
  await expect(validateCoupon('INVALID')).rejects.toThrow('Coupon not found')
})

// Or with try/catch
it('returns error object on validation failure', () => {
  const result = validateCoupon({ uses_count: 10, uses_limit: 10 })
  expect(result.valid).toBe(false)
  expect(result.reason).toBe('USES_EXHAUSTED')
})
```

**Component Testing (React Testing Library):**
```typescript
import { render, screen } from '@testing-library/react'

it('displays product price', () => {
  render(<ProductCard product={mockProduct({ base_price: 95000 })} />)
  expect(screen.getByText('$95.000')).toBeInTheDocument()
})

it('shows sold badge when status is sold', () => {
  render(<ProductCard product={mockProduct({ status: 'sold' })} />)
  expect(screen.getByText('Vendida')).toBeInTheDocument()
})
```

**E2E Testing (Playwright):**
```typescript
test('complete purchase flow with Stripe', async ({ page }) => {
  // 1. Navigate
  await page.goto('/es/catalogo')
  
  // 2. Select product
  await page.click('.product-card:first-child')
  await expect(page.locator('h1')).toContainText('Anillo')
  
  // 3. Add to cart
  await page.click('[data-testid="add-to-cart"]')
  await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1')
  
  // 4. Checkout with Stripe test card
  await page.click('[data-testid="checkout-btn"]')
  const stripeFrame = page.frameLocator('[data-testid="stripe-frame"]')
  await stripeFrame.locator('[placeholder="Número de tarjeta"]').fill('4242424242424242')
  
  // 5. Confirm and verify
  await page.click('[data-testid="confirm-order"]')
  await expect(page).toHaveURL(/\/confirmacion/)
  await expect(page.locator('[data-testid="order-confirmed"]')).toBeVisible()
})
```

## Configuration Files (To Create)

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        global: { lines: 70, functions: 70, branches: 65, statements: 70 },
        'src/lib/utils/': { lines: 90, functions: 90 },
        'src/app/api/': { lines: 80, functions: 80 },
      },
      exclude: ['src/types/**', 'src/test/**', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

**playwright.config.ts:**
```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

**src/test/setup.ts:**
```typescript
import '@testing-library/jest-dom'
import { server } from './mocks/server' // MSW server

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

## Lighthouse CI

**Config:** `lighthouserc.js` (already present)

**Thresholds:**
- Performance: ≥ 0.9 (error if below)
- SEO: ≥ 0.95 (error if below)
- Accessibility: ≥ 0.9 (warn if below)
- Largest Contentful Paint: ≤ 2500ms (error)
- Cumulative Layout Shift: ≤ 0.1 (error)
- Interaction to Next Paint: ≤ 200ms (error)

**URLs Tested:**
- `http://localhost:3000/` (homepage)
- `http://localhost:3000/es/catalogo` (catalog)

**Run:**
```bash
pnpm lhci autorun
```

## What NOT to Test

- Auto-generated code: `src/types/database.types.ts`
- Config files: `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`
- Purely visual components without logic (no interactions, no state)
- Page compositions that are just wrappers of tested components
- Next.js built-in features (routing, middleware, etc.)

## Best Practices

1. **Use factories, not hardcoded data** — Mock data centralized in `src/test/factories/`
2. **Test behavior, not implementation** — Focus on user actions, not function calls
3. **One assertion per test** (loose rule) — Multiple related assertions OK if testing one behavior
4. **Descriptive test names** — `it('calculates artisan net after 10% commission')` not `it('works')`
5. **No test interdependencies** — Each test must be runnable in isolation
6. **Verify error states** — Test unhappy paths (declined cards, invalid coupons, RLS violations)
7. **Use data-testid sparingly** — Prefer semantic queries (`getByRole`, `getByLabelText`)

---

*Testing analysis: 2026-04-12*
