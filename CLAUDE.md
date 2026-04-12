# Crisol

Marketplace de orfebrería artesanal. Para contexto profundo leer `docs/` (architecture, api_spec, erd_core, flow_*, project_structure, testing_strategy).

## Stack

Next.js App Router · TypeScript · Tailwind · next-intl (`es` default, `en`) · Zustand · Zod · Supabase (Postgres + Auth + Storage + RLS) · Stripe Connect (split payment) · Coinbase Commerce · Cloudinary · Resend + React Email · Couriers: Chilexpress, Starken, DHL, FedEx · Lighthouse CI · pnpm.

## Comandos

```bash
pnpm install | pnpm dev | pnpm build | pnpm start | pnpm lint | pnpm test
pnpm db:types                 # regenerar src/types/database.types.ts
supabase start | supabase migration new <nombre>
```

## Convenciones

- Archivos componente/lib: `kebab-case.(ts|tsx)`. Hooks: `use-*.ts`.
- TS: tipos `PascalCase`, funciones/vars `camelCase`, constantes `UPPER_SNAKE_CASE`.
- BD: tablas y columnas `snake_case`. Slugs URL: `kebab-case` sin tildes.
- Alias de import: `@/` → `src/`.

## Reglas de negocio

- RLS activo en toda tabla; `service_role key` solo server-side.
- Roles: `admin`, `artisan`, `buyer`. Layouts `/artesano` y `/admin` auth-guarded por rol.
- Estados de pieza: `draft → pending_review → published` (+ `changes_requested`, `rejected`, `sold`). Solo `published` es público.
- Estados de pedido: `pending_payment → paid → in_preparation → shipped → delivered` (+ `cancelled`). No saltar estados.
- Split payment: usar `lib/utils/commission.ts` con el % vigente en `config`. Nunca hardcodear comisión.
- Webhooks Stripe/Coinbase: verificar firma e idempotencia por `event.id`.
- Precios canónicos en **CLP**; USD es display-only vía `/api/currency`, no persistir.
- Input externo (API routes, server actions, webhooks) siempre validado con Zod.
- Uploads de media solo vía firma Cloudinary desde `/api/upload`. Respetar `MAX_PHOTOS_PER_PRODUCT`.
- Cambios en pieza/artesano/blog disparan revalidate on-demand con `REVALIDATE_SECRET`.
- Páginas públicas: `generateMetadata` + JSON-LD cuando aplique. Preservar `robots.txt` y `llms.txt`.
- Solo variables `NEXT_PUBLIC_*` llegan al cliente. Nunca exponer service_role, secret keys, webhook secrets, API keys de couriers ni `CRON_SECRET`.
- Migraciones forward-only y numeradas en `supabase/migrations/`. No editar migraciones aplicadas.
- `src/types/database.types.ts` es autogenerado; regenerar tras cada migración, no editar a mano.
- Locale `es` obligatorio; `en` puede estar incompleto pero su estructura debe existir.

## Git

- Ramas protegidas (nunca commitear directo): `main`, `develop`, `qa`, `uat`.
- Branching: `feature/*`, `fix/*`, `chore/*`, `hotfix/*` desde `develop`.
- Hotfixes críticos de producción: desde `main`, merge back a `main` + `develop`.
- Flujo: `feature/*` → `develop` → `qa` → `uat` → `main`.
- Formato de commit: `type(scope): descripción` — types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.
- Siempre mostrar el comando de push para que el usuario lo ejecute. Nunca hacer push ni merge.

## Testing

- Todo feature nuevo requiere tests E2E en Playwright antes de cerrar la rama.
- Archivos en `tests/e2e/<feature>.spec.ts`.
- Correr con `pnpm test:e2e` y confirmar que pasan antes de hacer commit final.
- Los tests deben cubrir el happy path completo y al menos un caso de error.
- Datos de prueba: usar factories de `src/test/factories/`, nunca datos hardcodeados.

## Instrucciones de respuesta

- Brevedad extrema: Usa solo frases de 3 a 6 palabras.
- Sin rellenos: Prohibido decir "Entiendo", "Aquí tienes el código" o "Espero que esto ayude".
- Prioridad técnica: Primero la herramienta o el código, luego el resultado, y solo si es crítico, una explicación mínima.