# Crisol — Estrategia de Testing
**Versión:** 1.0 | **Stack:** Vitest · React Testing Library · Playwright · MSW

---

## Filosofía

Testeamos **comportamiento de negocio**, no implementación. Un test que falla cuando el usuario no puede pagar es valioso. Un test que falla porque se renombró una función interna no lo es.

Regla de oro: **si el test no detectaría un bug real, no existe.**

---

## Stack de testing

| Herramienta | Uso | Justificación |
|---|---|---|
| **Vitest** | Unit e integration tests | Nativo ESM, 10× más rápido que Jest, compatible con Next.js 14 |
| **React Testing Library** | Componentes | Testea como el usuario interactúa, no la implementación |
| **Playwright** | E2E (flujos críticos) | Multi-browser, intercepta red, ideal para checkout y pagos |
| **MSW (Mock Service Worker)** | Mocking de APIs externas | Intercepta Stripe, Cloudinary, couriers en tests |
| **Supabase local** | Base de datos en tests | `supabase start` levanta PostgreSQL local con migraciones reales |

---

## Pirámide de testing

```
        /‾‾‾‾‾‾‾‾‾\
       /   E2E (10%)  \      ← Flujos críticos end-to-end
      /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
     /  Integration (30%) \  ← API routes, hooks, service layer
    /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
   /     Unit tests (60%)   \ ← Lógica pura, utils, calculadores
  /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
```

---

## Umbrales de cobertura

| Capa | Cobertura mínima | Justificación |
|---|---|---|
| `src/lib/utils/` | **90%** | Lógica de negocio pura, sin dependencias |
| `src/app/api/` | **80%** | API routes con lógica crítica |
| `src/components/` | **60%** | Componentes UI, menos crítico |
| `src/hooks/` | **75%** | Hooks con estado compartido |
| **Total proyecto** | **70%** | Umbral global — CI falla si baja |

---

## Qué testeamos obligatoriamente (MUST)

### 1. Lógica financiera — cobertura 100%

Todo lo que toca dinero debe tener tests exhaustivos.

```typescript
// src/lib/utils/commission.test.ts

describe('calculateSplit', () => {
  it('descuenta comisión correcta del total', () => {
    const result = calculateSplit(185000, 10)
    expect(result.commission).toBe(18500)
    expect(result.artisanNet).toBe(166500)
  })

  it('maneja decimales sin perder centavos', () => {
    const result = calculateSplit(99990, 10)
    expect(result.commission + result.artisanNet).toBe(99990)
  })

  it('lanza error si commission_pct fuera de rango', () => {
    expect(() => calculateSplit(100000, 55)).toThrow('commission_pct must be between 0 and 50')
  })
})

describe('applyDiscount', () => {
  it('aplica descuento porcentual correctamente', () => {
    expect(applyDiscount(185000, { type: 'percentage', value: 10 })).toBe(166500)
  })

  it('aplica descuento fijo correctamente', () => {
    expect(applyDiscount(185000, { type: 'fixed', value: 10000 })).toBe(175000)
  })

  it('no permite descuento mayor al total', () => {
    expect(applyDiscount(5000, { type: 'fixed', value: 10000 })).toBe(0)
  })
})

describe('redeemPoints', () => {
  it('convierte puntos a CLP según la tasa configurada', () => {
    // 1 punto = 10 CLP
    expect(pointsToCLP(50, 10)).toBe(500)
  })

  it('no permite canjear más puntos de los disponibles', () => {
    expect(() => redeemPoints(50, { available: 30, rate: 10 }))
      .toThrow('Insufficient points')
  })

  it('no permite canjear más del total del pedido', () => {
    const result = redeemPoints(500, { available: 500, rate: 10, orderTotal: 3000 })
    expect(result.discount).toBe(3000) // máximo = total del pedido
  })
})
```

### 2. Validación de cupones

```typescript
// src/lib/utils/coupon.test.ts

describe('validateCoupon', () => {
  it('rechaza cupón expirado', () => {
    const expired = { expires_at: '2020-01-01', is_active: true, uses_count: 0, uses_limit: 10 }
    expect(validateCoupon(expired)).toEqual({ valid: false, reason: 'EXPIRED' })
  })

  it('rechaza cupón sin usos restantes', () => {
    const exhausted = { expires_at: null, is_active: true, uses_count: 10, uses_limit: 10 }
    expect(validateCoupon(exhausted)).toEqual({ valid: false, reason: 'USES_EXHAUSTED' })
  })

  it('rechaza cupón inactivo', () => {
    const inactive = { expires_at: null, is_active: false, uses_count: 0, uses_limit: null }
    expect(validateCoupon(inactive)).toEqual({ valid: false, reason: 'INACTIVE' })
  })

  it('acepta cupón con usos ilimitados (uses_limit: null)', () => {
    const unlimited = { expires_at: null, is_active: true, uses_count: 999, uses_limit: null }
    expect(validateCoupon(unlimited)).toEqual({ valid: true })
  })
})
```

### 3. Webhook de Stripe — flujo crítico

```typescript
// src/app/api/webhooks/stripe/route.test.ts

import { createMockStripeEvent } from '@/test/factories/stripe'

describe('POST /api/webhooks/stripe', () => {
  it('rechaza evento con firma inválida', async () => {
    const response = await POST(createMockRequest({ signature: 'invalid' }))
    expect(response.status).toBe(400)
  })

  it('procesa payment_intent.succeeded correctamente', async () => {
    const event = createMockStripeEvent('payment_intent.succeeded', {
      id: 'pi_test_123',
      metadata: { order_id: 'order-uuid-123' },
      amount: 18500000, // en centavos
    })

    const response = await POST(createMockRequest({ event, validSignature: true }))
    expect(response.status).toBe(200)

    // Verificar que se creó el PAYMENT en la BD
    const payment = await db.payment.findByOrderId('order-uuid-123')
    expect(payment?.status).toBe('paid')
    expect(payment?.artisan_net).toBe(166500) // 185000 - 10%

    // Verificar que ORDER se actualizó
    const order = await db.order.findById('order-uuid-123')
    expect(order?.status).toBe('paid')
  })

  it('es idempotente — no duplica pago si recibe el mismo evento dos veces', async () => {
    const event = createMockStripeEvent('payment_intent.succeeded', { id: 'pi_test_duplicate' })
    await POST(createMockRequest({ event, validSignature: true }))
    await POST(createMockRequest({ event, validSignature: true })) // segunda vez

    const payments = await db.payment.findAll({ stripePaymentIntentId: 'pi_test_duplicate' })
    expect(payments.length).toBe(1) // solo uno
  })
})
```

### 4. Políticas RLS de Supabase

```typescript
// src/test/rls/product.test.ts
// Requiere: supabase start (BD local con migraciones aplicadas)

describe('RLS: product table', () => {
  it('artesano A no puede ver borradores de artesano B', async () => {
    const draftByArtisanB = await seedProduct({ artisan: 'artisan-b', status: 'draft' })
    const clientAsArtisanA = createSupabaseClient({ role: 'artisan', userId: 'artisan-a' })

    const { data } = await clientAsArtisanA.from('product').select().eq('id', draftByArtisanB.id)
    expect(data).toHaveLength(0)
  })

  it('invitado solo ve productos publicados', async () => {
    await seedProduct({ status: 'draft' })
    await seedProduct({ status: 'pending_review' })
    await seedProduct({ status: 'published' })

    const anonClient = createSupabaseClient({ role: 'anon' })
    const { data } = await anonClient.from('product').select()
    expect(data?.every(p => p.status === 'published')).toBe(true)
  })

  it('comprador no puede ver pagos de otro comprador', async () => {
    const payment = await seedPayment({ buyerId: 'buyer-b' })
    const clientAsBuyerA = createSupabaseClient({ role: 'buyer', userId: 'buyer-a' })

    const { data } = await clientAsBuyerA.from('payment').select().eq('id', payment.id)
    expect(data).toHaveLength(0)
  })
})
```

### 5. Componentes críticos de UI

```typescript
// src/components/catalog/product-card.test.tsx

describe('ProductCard', () => {
  it('muestra badge "Vendida" cuando status = sold', () => {
    render(<ProductCard product={mockProduct({ status: 'sold' })} />)
    expect(screen.getByText('Vendida')).toBeInTheDocument()
  })

  it('muestra indicador 3D cuando hay modelo 3D', () => {
    render(<ProductCard product={mockProduct({ has3dModel: true })} />)
    expect(screen.getByText('3D')).toBeInTheDocument()
  })

  it('no muestra precio en piezas vendidas', () => {
    render(<ProductCard product={mockProduct({ status: 'sold', price: 185000 })} />)
    expect(screen.queryByText('$185.000')).not.toBeInTheDocument()
  })
})

// src/components/checkout/order-summary.test.tsx

describe('OrderSummary', () => {
  it('muestra subtotal + envío + descuento + total correctamente', () => {
    render(<OrderSummary order={mockOrder({
      subtotal: 185000, shippingCost: 4990, discountAmount: 19490, total: 170500
    })} />)
    expect(screen.getByText('$185.000')).toBeInTheDocument()
    expect(screen.getByText('$4.990')).toBeInTheDocument()
    expect(screen.getByText('–$19.490')).toBeInTheDocument()
    expect(screen.getByText('$170.500')).toBeInTheDocument()
  })

  it('muestra aviso legal de no devoluciones', () => {
    render(<OrderSummary order={mockOrder()} />)
    expect(screen.getByText(/Sin devoluciones/)).toBeInTheDocument()
  })
})
```

---

## Tests E2E con Playwright (flujos críticos)

```typescript
// tests/e2e/purchase.spec.ts

test.describe('Flujo de compra completo', () => {
  test('comprador invitado completa una compra con Stripe', async ({ page }) => {
    // 1. Navegar al catálogo
    await page.goto('/es/catalogo')
    await expect(page.locator('.product-card')).toHaveCount(6)

    // 2. Abrir detalle de pieza
    await page.click('.product-card:first-child')
    await expect(page.locator('h1')).toContainText('Anillo')

    // 3. Seleccionar variante y agregar al carrito
    await page.click('[data-testid="variant-15"]')
    await page.click('[data-testid="add-to-cart"]')
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1')

    // 4. Ir al checkout
    await page.click('[data-testid="cart-icon"]')
    await page.click('[data-testid="checkout-btn"]')

    // 5. Completar dirección
    await page.fill('[name="full_name"]', 'Ana Torres')
    await page.fill('[name="address_line1"]', 'Av. Providencia 1234')
    await page.fill('[name="city"]', 'Santiago')
    await page.selectOption('[name="country_code"]', 'CL')

    // 6. Seleccionar courier
    await page.click('[data-testid="courier-chilexpress"]')

    // 7. Completar pago con tarjeta de test de Stripe
    const stripeFrame = page.frameLocator('[data-testid="stripe-frame"]')
    await stripeFrame.locator('[placeholder="Número de tarjeta"]').fill('4242424242424242')
    await stripeFrame.locator('[placeholder="MM / AA"]').fill('12/29')
    await stripeFrame.locator('[placeholder="CVC"]').fill('123')

    // 8. Confirmar pedido
    await page.click('[data-testid="confirm-order"]')

    // 9. Verificar confirmación
    await expect(page).toHaveURL(/\/confirmacion/)
    await expect(page.locator('[data-testid="order-confirmed"]')).toBeVisible()
    await expect(page.locator('[data-testid="order-id"]')).toBeVisible()
  })

  test('muestra error cuando pago falla (tarjeta declinada)', async ({ page }) => {
    // ... setup igual ...
    // Usar tarjeta de test que Stripe rechaza
    await stripeFrame.locator('[placeholder="Número de tarjeta"]').fill('4000000000000002')
    await page.click('[data-testid="confirm-order"]')
    await expect(page.locator('[data-testid="payment-error"]')).toContainText('Tu tarjeta fue rechazada')
  })
})

// tests/e2e/publication.spec.ts

test.describe('Flujo de publicación de pieza', () => {
  test('artesano sube pieza → admin aprueba → aparece en catálogo', async ({ browser }) => {
    const artisanPage = await browser.newPage()
    const adminPage = await browser.newPage()

    // Artesano: crear y enviar pieza a revisión
    await loginAs(artisanPage, 'artisan')
    await artisanPage.goto('/artesano/piezas/nueva')
    await artisanPage.fill('[name="title"]', 'Anillo test playwright')
    await artisanPage.fill('[name="base_price"]', '95000')
    await artisanPage.click('[data-testid="submit-review"]')
    await expect(artisanPage.locator('[data-testid="status-badge"]')).toHaveText('En revisión')

    // Admin: aprobar pieza
    await loginAs(adminPage, 'admin')
    await adminPage.goto('/admin/piezas/revision')
    await adminPage.click('[data-testid="approve-btn"]:first-child')
    await expect(adminPage.locator('[data-testid="toast"]')).toContainText('Pieza aprobada')

    // Verificar que aparece en el catálogo público
    const publicPage = await browser.newPage()
    await publicPage.goto('/es/catalogo')
    await expect(publicPage.locator('text=Anillo test playwright')).toBeVisible()
  })
})
```

---

## Estructura de carpetas de tests

```
src/
├── test/
│   ├── setup.ts                # Configuración global de Vitest
│   ├── factories/              # Factories de datos de prueba
│   │   ├── product.ts
│   │   ├── order.ts
│   │   ├── user.ts
│   │   └── stripe.ts
│   └── utils/
│       ├── db.ts               # Helpers para Supabase local
│       └── auth.ts             # Helpers de autenticación en tests
│
tests/
└── e2e/
    ├── purchase.spec.ts
    ├── publication.spec.ts
    ├── auth.spec.ts
    └── loyalty.spec.ts
```

---

## Configuración

### `vitest.config.ts`
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

### `playwright.config.ts`
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
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### `src/test/setup.ts`
```typescript
import '@testing-library/jest-dom'
import { server } from './mocks/server' // MSW server

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

---

## Scripts de package.json

```json
{
  "scripts": {
    "test":           "vitest",
    "test:run":       "vitest run",
    "test:coverage":  "vitest run --coverage",
    "test:ui":        "vitest --ui",
    "test:e2e":       "playwright test",
    "test:e2e:ui":    "playwright test --ui",
    "test:rls":       "vitest run --project rls",
    "test:all":       "npm run test:run && npm run test:e2e"
  }
}
```

---

## Lo que NO testeamos

- Código generado automáticamente (`database.types.ts`)
- Archivos de configuración (`next.config.ts`, `tailwind.config.ts`)
- Componentes puramente visuales sin lógica
- Páginas que son solo composición de componentes ya testeados

---

## Datos de test — regla

Nunca usar datos hardcodeados en los tests. Todo dato de prueba se crea con factories:

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
  ...overrides,
})
```

Esto permite que un cambio en el modelo de datos solo requiera actualizar la factory, no todos los tests.
