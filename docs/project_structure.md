# Crisol — Estructura del Proyecto Next.js 14
**Versión:** 1.0 | **Stack:** Next.js 14 App Router · TypeScript · Supabase · Tailwind CSS

---

## Árbol de carpetas

```
crisol/
│
├── .env.local                    # Variables de entorno locales (no commitear)
├── .env.example                  # Plantilla de variables (sí commitear)
├── .env.production               # Variables de producción (Vercel env vars)
│
├── next.config.ts                # Configuración de Next.js
├── tailwind.config.ts            # Configuración de Tailwind CSS
├── tsconfig.json                 # Configuración de TypeScript
├── middleware.ts                 # Edge Middleware (i18n + auth guard)
├── package.json
├── lighthouserc.js               # Configuración Lighthouse CI
│
├── messages/                     # Traducciones (next-intl)
│   ├── es.json                   # Español (lanzamiento)
│   └── en.json                   # Inglés (estructura lista, vacío al inicio)
│
├── public/
│   ├── favicon.ico
│   ├── robots.txt                # Permite GPTBot, Googlebot, Bingbot
│   ├── llms.txt                  # Instrucciones para LLMs (AEO)
│   └── icons/
│
└── src/
    ├── app/                      # Next.js App Router
    │   │
    │   ├── [locale]/             # Rutas públicas localizadas (es, en)
    │   │   ├── layout.tsx        # Root layout con providers
    │   │   ├── page.tsx          # Home → catálogo destacado
    │   │   ├── not-found.tsx
    │   │   │
    │   │   ├── catalogo/
    │   │   │   ├── page.tsx                  # Catálogo con filtros (SSG + ISR)
    │   │   │   └── [slug]/
    │   │   │       └── page.tsx              # Detalle de pieza (ISR + visor 3D)
    │   │   │
    │   │   ├── artesanos/
    │   │   │   └── [slug]/
    │   │   │       └── page.tsx              # Perfil público del artesano (ISR)
    │   │   │
    │   │   ├── encargos/
    │   │   │   └── page.tsx                  # Slots de encargo disponibles
    │   │   │
    │   │   ├── carrito/
    │   │   │   └── page.tsx                  # Carrito (CSR con Zustand)
    │   │   │
    │   │   ├── checkout/
    │   │   │   ├── page.tsx                  # Checkout completo
    │   │   │   └── confirmacion/
    │   │   │       └── page.tsx              # Confirmación post-pago
    │   │   │
    │   │   ├── cuenta/                       # Panel del comprador
    │   │   │   ├── layout.tsx                # Auth guard + sidebar
    │   │   │   ├── page.tsx                  # Dashboard del comprador
    │   │   │   ├── pedidos/
    │   │   │   │   ├── page.tsx              # Lista de pedidos
    │   │   │   │   └── [id]/
    │   │   │   │       └── page.tsx          # Detalle de pedido + tracking
    │   │   │   ├── favoritos/
    │   │   │   │   └── page.tsx
    │   │   │   ├── puntos/
    │   │   │   │   └── page.tsx              # Panel de puntos y membresía
    │   │   │   └── perfil/
    │   │   │       └── page.tsx
    │   │   │
    │   │   ├── blog/
    │   │   │   ├── page.tsx                  # Listado de artículos (SSG + ISR)
    │   │   │   └── [slug]/
    │   │   │       └── page.tsx              # Artículo individual
    │   │   │
    │   │   ├── auth/
    │   │   │   ├── login/
    │   │   │   │   └── page.tsx
    │   │   │   ├── registro/
    │   │   │   │   └── page.tsx
    │   │   │   └── callback/
    │   │   │       └── route.ts              # OAuth callback de Supabase
    │   │   │
    │   │   └── (seo)/                        # Páginas SEO/AEO (route group)
    │   │       ├── glosario/
    │   │       │   └── page.tsx              # Glosario de orfebrería
    │   │       ├── guias/
    │   │       │   └── page.tsx              # Guías de compra
    │   │       └── faq/
    │   │           └── page.tsx              # FAQ (FAQPage schema)
    │   │
    │   ├── artesano/                         # Panel del artesano (sin localización)
    │   │   ├── layout.tsx                    # Auth guard (role: artisan) + sidebar
    │   │   ├── page.tsx                      # Dashboard: resumen de ventas
    │   │   ├── piezas/
    │   │   │   ├── page.tsx                  # Mis piezas con estados
    │   │   │   ├── nueva/
    │   │   │   │   └── page.tsx              # Formulario de nueva pieza
    │   │   │   └── [id]/
    │   │   │       └── editar/
    │   │   │           └── page.tsx          # Editar pieza existente
    │   │   ├── encargos/
    │   │   │   └── page.tsx                  # Gestionar slots
    │   │   ├── pedidos/
    │   │   │   ├── page.tsx                  # Pedidos entrantes
    │   │   │   └── [id]/
    │   │   │       └── page.tsx              # Detalle + cambio de estado
    │   │   ├── balance/
    │   │   │   └── page.tsx                  # Balance, neto y comisiones
    │   │   └── perfil/
    │   │       └── page.tsx                  # Editar perfil público
    │   │
    │   ├── admin/                            # Panel de administración
    │   │   ├── layout.tsx                    # Auth guard (role: admin) + sidebar
    │   │   ├── page.tsx                      # Dashboard con métricas clave
    │   │   ├── piezas/
    │   │   │   └── revision/
    │   │   │       └── page.tsx              # Cola de moderación
    │   │   ├── artesanos/
    │   │   │   ├── page.tsx                  # Gestionar artesanos
    │   │   │   └── [id]/
    │   │   │       └── page.tsx
    │   │   ├── pedidos/
    │   │   │   └── page.tsx
    │   │   ├── cupones/
    │   │   │   └── page.tsx
    │   │   ├── membresias/
    │   │   │   └── page.tsx                  # Configurar niveles y beneficios
    │   │   ├── comision/
    │   │   │   └── page.tsx                  # Configurar % comisión
    │   │   ├── resenas/
    │   │   │   └── page.tsx                  # Moderar reseñas
    │   │   ├── reportes/
    │   │   │   └── page.tsx                  # Dashboards + exportación
    │   │   ├── seo/
    │   │   │   └── page.tsx                  # Editar SEO_META por entidad
    │   │   └── blog/
    │   │       ├── page.tsx
    │   │       └── [id]/
    │   │           └── page.tsx
    │   │
    │   └── api/                              # API Routes (Route Handlers)
    │       ├── webhooks/
    │       │   ├── stripe/
    │       │   │   └── route.ts              # Webhook Stripe (pago confirmado)
    │       │   └── coinbase/
    │       │       └── route.ts              # Webhook Coinbase (pago cripto)
    │       ├── couriers/
    │       │   └── quote/
    │       │       └── route.ts              # Cotización de envío unificada
    │       ├── upload/
    │       │   └── route.ts                  # Firma de upload a Cloudinary
    │       ├── revalidate/
    │       │   └── route.ts                  # On-demand ISR revalidation
    │       ├── currency/
    │       │   └── route.ts                  # Tipo de cambio CLP/USD
    │       └── og/
    │           └── route.ts                  # Open Graph image generation
    │
    ├── components/
    │   ├── ui/                               # Primitivos reutilizables
    │   │   ├── button.tsx
    │   │   ├── input.tsx
    │   │   ├── badge.tsx
    │   │   ├── dialog.tsx
    │   │   ├── sheet.tsx
    │   │   ├── select.tsx
    │   │   ├── toast.tsx
    │   │   └── skeleton.tsx
    │   │
    │   ├── catalog/
    │   │   ├── product-card.tsx              # Card del catálogo con imagen + precio
    │   │   ├── product-grid.tsx              # Grid responsivo con lazy loading
    │   │   ├── product-filters.tsx           # Panel de filtros (tipo, material, precio)
    │   │   ├── product-viewer-3d.tsx         # Wrapper de @google/model-viewer
    │   │   └── product-gallery.tsx           # Galería de fotos + video
    │   │
    │   ├── cart/
    │   │   ├── cart-sheet.tsx                # Drawer lateral del carrito
    │   │   └── cart-item.tsx
    │   │
    │   ├── checkout/
    │   │   ├── checkout-form.tsx             # Dirección + courier
    │   │   ├── payment-stripe.tsx            # Stripe Elements
    │   │   ├── payment-crypto.tsx            # Coinbase Commerce widget
    │   │   └── order-summary.tsx
    │   │
    │   ├── artisan/
    │   │   ├── artisan-card.tsx              # Card en catálogo
    │   │   └── artisan-profile-header.tsx    # Header del perfil público
    │   │
    │   ├── loyalty/
    │   │   ├── points-display.tsx            # Indicador de puntos en header
    │   │   ├── membership-badge.tsx          # Badge de nivel (Estándar / Premium)
    │   │   └── points-redeem.tsx             # Control de canje en checkout
    │   │
    │   ├── seo/
    │   │   ├── structured-data.tsx           # JSON-LD injector (Schema.org)
    │   │   └── breadcrumb.tsx                # Breadcrumb visual + schema
    │   │
    │   └── layout/
    │       ├── header.tsx
    │       ├── footer.tsx
    │       ├── locale-switcher.tsx           # Selector de idioma
    │       └── currency-switcher.tsx         # Selector CLP / USD
    │
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts                     # createBrowserClient (CSR)
    │   │   ├── server.ts                     # createServerClient (SSR / RSC)
    │   │   └── middleware.ts                 # refreshSession en cada request
    │   │
    │   ├── stripe/
    │   │   ├── client.ts                     # Stripe SDK server-side
    │   │   └── split.ts                      # Lógica de split payment + transfer
    │   │
    │   ├── cloudinary/
    │   │   ├── upload.ts                     # Firma de upload + transformaciones
    │   │   └── config.ts
    │   │
    │   ├── couriers/
    │   │   ├── index.ts                      # Interfaz unificada de cotización
    │   │   ├── chilexpress.ts
    │   │   ├── starken.ts
    │   │   ├── dhl.ts
    │   │   └── fedex.ts
    │   │
    │   ├── resend/
    │   │   ├── client.ts
    │   │   └── templates/
    │   │       ├── order-confirmed.tsx       # React Email template
    │   │       ├── order-shipped.tsx
    │   │       ├── order-delivered.tsx
    │   │       ├── piece-approved.tsx
    │   │       ├── piece-rejected.tsx
    │   │       └── artisan-new-piece.tsx     # Notificación a seguidores
    │   │
    │   ├── seo/
    │   │   ├── metadata.ts                   # generateMetadata helpers
    │   │   ├── schema.ts                     # Generadores de Schema.org JSON-LD
    │   │   └── sitemap.ts                    # Helpers para next-sitemap
    │   │
    │   └── utils/
    │       ├── currency.ts                   # Conversión CLP ↔ USD
    │       ├── slugify.ts                    # Generador de slugs con unaccent
    │       ├── format.ts                     # Formateo de precios, fechas, etc.
    │       └── commission.ts                 # Cálculo de comisión y neto artesano
    │
    ├── hooks/
    │   ├── use-cart.ts                       # Carrito (Zustand)
    │   ├── use-wishlist.ts                   # Favoritos con optimistic updates
    │   ├── use-currency.ts                   # Moneda activa (CLP / USD)
    │   └── use-notifications.ts              # Suscripción a notificaciones
    │
    ├── store/                                # Estado global (Zustand)
    │   ├── cart.store.ts
    │   └── currency.store.ts
    │
    └── types/
        ├── database.types.ts                 # ⚠ Auto-generado por Supabase CLI
        ├── api.types.ts                      # Tipos de request/response de la API
        └── index.ts                          # Re-exporta tipos de negocio
```

---

## Archivos de configuración clave

### `next.config.ts`
```typescript
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'res.cloudinary.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['@google/model-viewer'],
  },
}

export default withNextIntl(nextConfig)
```

### `middleware.ts`
```typescript
import createMiddleware from 'next-intl/middleware'
import { updateSession } from '@/lib/supabase/middleware'
import { NextRequest } from 'next/server'

const intlMiddleware = createMiddleware({
  locales: ['es', 'en'],
  defaultLocale: 'es',
})

export async function middleware(request: NextRequest) {
  // 1. Refresh Supabase session
  const { response } = await updateSession(request)
  // 2. i18n routing
  return intlMiddleware(request)
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
```

### `lighthouserc.js`
```javascript
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/', 'http://localhost:3000/es/catalogo'],
      startServerCommand: 'npm run build && npm run start',
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
```

---

## Convenciones de nomenclatura

| Elemento | Convención | Ejemplo |
|---|---|---|
| Archivos de componente | `kebab-case.tsx` | `product-card.tsx` |
| Archivos de hook | `use-nombre.ts` | `use-cart.ts` |
| Archivos de lib | `kebab-case.ts` | `stripe-split.ts` |
| Tipos de TypeScript | `PascalCase` | `ProductWithMedia` |
| Variables y funciones | `camelCase` | `getProductBySlug` |
| Constantes globales | `UPPER_SNAKE_CASE` | `MAX_PHOTOS_PER_PRODUCT` |
| Rutas de API | `kebab-case` | `/api/couriers/quote` |
| Tablas de BD | `snake_case` | `order_item` |
| Columnas de BD | `snake_case` | `artisan_id` |
| Slugs de URL | `kebab-case-sin-tildes` | `pendientes-plata-925` |

---

## Estrategia de rendering por sección

| Sección | Estrategia | Justificación |
|---|---|---|
| Catálogo principal | SSG + ISR | SEO crítico, actualiza al publicar pieza |
| Detalle de pieza | ISR (revalidate on-demand) | SEO crítico, actualiza al aprobar edición |
| Perfil de artesano | ISR | SEO, cambia poco |
| Blog | SSG + ISR | SEO máximo |
| FAQ / Glosario / Guías | SSG | Contenido estático, SEO/AEO |
| Checkout | SSR | Requiere sesión y datos en tiempo real |
| Panel comprador | SSR + CSR | Datos personales, no indexable |
| Panel artesano | SSR + CSR | Datos de negocio, auth requerida |
| Panel admin | SSR + CSR | Datos sensibles, auth requerida |
| Carrito | CSR (Zustand) | Estado local, sin servidor |

---

## Generación automática de tipos Supabase

Ejecutar después de cada migración SQL para mantener los tipos sincronizados:

```bash
npx supabase gen types typescript \
  --project-id TU_PROJECT_ID \
  --schema public \
  > src/types/database.types.ts
```

Agregar este comando como script en `package.json`:
```json
{
  "scripts": {
    "db:types": "supabase gen types typescript --project-id $SUPABASE_PROJECT_ID --schema public > src/types/database.types.ts"
  }
}
```

---

## Constantes importantes

```typescript
// src/lib/utils/constants.ts

export const MAX_PHOTOS_PER_PRODUCT = 10
export const SUPPORTED_LOCALES = ['es', 'en'] as const
export const DEFAULT_LOCALE = 'es'
export const SUPPORTED_CURRENCIES = ['CLP', 'USD'] as const
export const DEFAULT_CURRENCY = 'CLP'

export const PRODUCT_STATUSES = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  PUBLISHED: 'published',
  CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected',
  SOLD: 'sold',
} as const

export const ORDER_STATUSES = {
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  IN_PREPARATION: 'in_preparation',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const

export const USER_ROLES = {
  ADMIN: 'admin',
  ARTISAN: 'artisan',
  BUYER: 'buyer',
} as const
```

---

## Dependencias principales

```json
{
  "dependencies": {
    "next": "14.x",
    "react": "18.x",
    "typescript": "5.x",
    "@supabase/supabase-js": "^2",
    "@supabase/ssr": "^0",
    "next-intl": "^3",
    "stripe": "^14",
    "@stripe/stripe-js": "^3",
    "@stripe/react-stripe-js": "^2",
    "cloudinary": "^2",
    "resend": "^3",
    "@react-email/components": "^0",
    "zustand": "^4",
    "tailwindcss": "^3",
    "zod": "^3"
  },
  "devDependencies": {
    "@lighthouse-ci/cli": "^0",
    "next-sitemap": "^4",
    "supabase": "^1"
  }
}
```
