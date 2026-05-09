# Phase 3: Commerce - Context

**Gathered:** 2026-05-09
**Updated:** 2026-05-09 (D-SPLIT — Stripe Connect descartado, single-account model)
**Status:** Ready for planning

<domain>
## Phase Boundary

Visitantes (invitado o registrado) pueden agregar piezas de múltiples artesanos al carrito, avanzar a checkout con cotización de courier y cupón opcional, y pagar vía Stripe (single-account de plataforma) — generando un pedido confirmado con snapshot inmutable de precios y un registro contable `artisan_payout` por cada artesano que el admin liquida manualmente fuera de Stripe. La gestión post-pago (state machine, fulfillment, tracking, emails transaccionales más allá de la confirmación inicial) es Phase 4. Crypto payments (Coinbase) y envío internacional se difieren.

**Nota:** Stripe Connect Separate Charges & Transfers no está disponible en Chile (verificado en research). Se adopta single-account model con liquidación manual (ver D-SPLIT y D-07).

</domain>

<decisions>
## Implementation Decisions

### Phase 1 Carry-Forwards (Updated)
- **Phase 1 D-02 SUPERSEDED:** El modelo Stripe Connect (Express accounts) decidido en Phase 1 D-02 queda **obsoleto**. Stripe Connect Separate Charges & Transfers no está soportado en Chile. Phase 3 adopta single-account model (D-SPLIT abajo).
- **Restauración de campos bancarios:** Los campos eliminados en Phase 1 D-02 (`bank_name`, `bank_account_type`, `bank_account_number`, `bank_rut`, `bank_email`) deben **restaurarse** en `artisan` vía nueva migración Phase 3 (e.g. `010_restore_artisan_bank_fields.sql`). Son requeridos para que el admin sepa a dónde transferir manualmente. Mantener `stripe_account_id` nullable y sin uso (no eliminar para evitar migración destructiva sobre datos existentes).
- **Phase 1 D-06 (email verificado para checkout):** Se mantiene vigente — buyers registrados requieren email verificado antes de pagar. Guests usan magic-link post-confirmación.
- **Phase 1 D-07/D-08 (commission_config + 10%):** Vigentes. `commission_pct_snapshot` se replica también en `artisan_payout` para auditoría.


### Cart UX
- **D-01:** Cart Sheet (slide-over) **y** página dedicada `/carrito` — sheet para vista rápida desde el header, página completa para edición detallada. Reusa el scaffold `cart-sheet.tsx`.
- **D-02:** Carrito persiste en `localStorage` para todos (guests y logged users) vía Zustand store `cart.store.ts`. Sin sincronización a DB esta fase. Cumple COMR-01.
- **D-03:** Carrito soporta piezas de múltiples artesanos en una sola orden (COMR-02). UI muestra agrupación visual por artesano dentro del carrito y resumen.

### Guest Checkout
- **D-04:** Guest checkout permitido con email + datos de envío. Orden queda asociada al email; se ofrece "crear cuenta" como upsell opcional en la página de confirmación. Maximiza conversión.
- **D-05:** Buyers registrados deben tener email verificado antes de poder pagar (carry-forward Phase 1, D-06). Para guests, el email ingresado en checkout no requiere verificación previa pero recibe magic-link en la confirmación para acceder al detalle del pedido.

### Stock Validation
- **D-06:** Validación de stock en tres checkpoints: (1) al agregar al carrito, (2) al abrir checkout, (3) al confirmar el pago en el webhook. El decremento atómico de `product_variant.stock` ocurre en el webhook de pago confirmado para evitar oversell.

### Multi-Artisan Split Payment
- **D-SPLIT (LOCKED):** **Single-account model** — Crisol recibe todos los pagos en una única cuenta Stripe de plataforma. **NO se usa Stripe Connect**, **NO se crean Express accounts**, **NO se invoca `stripe.transfers.create`**. El admin transfiere manualmente el neto a cada artesano vía transferencia bancaria fuera de Stripe. La tabla `artisan_payout` trackea cada payout pendiente/completado como registro contable interno. Razón: Stripe Connect Separate Charges & Transfers no está disponible en Chile (research 2026-05-09).
- **D-07 (REPLACES previous Connect decision):** Una sola `PaymentIntent` por orden cobrada por la cuenta plataforma. Sin `transfer_data`, sin `destination`, sin `application_fee_amount`. El "split" es puramente contable: al confirmarse el pago, el webhook crea N filas en `artisan_payout` (una por artesano participante en la orden) con `amount_clp = subtotal_artisano - comision_artisano + envio_artisano`, estado `pending`.
- **D-08:** Comisión calculada por `lib/utils/commission.ts` (Phase 1) sobre el subtotal de cada artesano. Snapshot del `commission_pct` activo se guarda en `order.commission_pct_snapshot` y se replica en `artisan_payout.commission_pct_snapshot` para auditoría.
- **D-09:** El costo de envío **no** entra en la base de cálculo de comisión — el envío va íntegro al artesano (sumado a `artisan_payout.amount_clp`).
- **D-PAYOUT-LIQ:** La liquidación manual (admin marca `artisan_payout.status = paid` con `paid_at`, `bank_reference`) es **fuera de alcance** de Phase 3. Phase 3 solo crea los registros `pending`. La UI admin de liquidación es Phase 5 (Dashboards & Operations).

### Shipping Quotes
- **D-10:** Cotización **por artesano** — cada artesano tiene su propio shipment con courier y costo independientes. UI muestra desglose: "Envío Artesano A: $X · Artesano B: $Y". Se alinea con el modelo de fulfillment per-artisan de Phase 4.
- **D-11:** Couriers integrados en Phase 3: **Chilexpress y Starken** (nacional). Quote on-demand al ingresar dirección de envío + botón "Cotizar". Timeout configurable (~5s).
- **D-12:** Fallback: tarifa plana por región desde tabla de configuración (admin-editable). Surface como "Tarifa estándar (envío estimado)" con nota. Nunca bloquea el checkout. Cumple COMR-05.
- **D-13:** Phase 3 = solo Chile. DHL/FedEx scaffolds quedan vacíos. UI bloquea selección de país ≠ Chile o muestra "Próximamente". Internacional se difiere a fase posterior.

### Coupons
- **D-14:** El descuento aplica **solo al subtotal** (precios de piezas). El envío siempre se cobra completo. No hay configurabilidad por cupón en esta fase.
- **D-15:** **La plataforma absorbe el descuento**: primero se reduce contra la comisión; si el descuento excede la comisión, la plataforma asume la diferencia. El artesano siempre recibe el neto completo de su pieza. Protege márgenes del artesano (modelo familiar).
- **D-16:** **Un cupón por orden** — sin stacking. Single input field en checkout. Validación: vigencia, `uses_limit`, `min_order`, `is_active` (COUP-03).
- **D-17:** Códigos privados administrados por admin (CRUD admin se difiere a Phase 5 para CRUD UI completa, pero esta fase necesita el mínimo: insertar/editar cupones para QA — TBD si vía seed o panel mínimo). No hay galería pública de cupones esta fase.

### Checkout Flow
- **D-18:** Layout single-page con secciones scrolleables: Contacto → Dirección de envío → Método de envío (cotización por artesano) → Cupón (opcional) → Pago (Stripe Elements) → Resumen sticky a la derecha. Estilo Shopify/moderno.
- **D-19:** Disclaimers (no devoluciones COMR-03 + impuestos internacionales COMR-09 cuando aplique) renderizados **inline justo arriba del botón "Pagar"** con **checkbox de aceptación obligatorio** ("He leído y acepto"). El botón Pagar está deshabilitado hasta marcar.
- **D-20:** Snapshot inmutable: al crear el `order` desde el webhook, copiar `snapshot_title` y precio (con modificador de variante incluido) en cada `order_item`. Cumple COMR-08.

### Stripe Webhook
- **D-21:** Webhook `/api/webhooks/stripe` (scaffold existe vacío) verifica firma con `stripe.webhooks.constructEvent` y aplica idempotencia consultando/insertando en `webhook_idempotency` (tabla creada en Phase 1, FOUND-06) por `event.id` antes de procesar. Cumple COMR-07.
- **D-22:** El pedido se crea **solo** al recibir `payment_intent.succeeded` (o `charge.succeeded` según research) — nunca antes. Pre-pago no existe registro en tabla `order`.

### Post-Payment UX
- **D-23:** Página de éxito: redirect a `/pedido/{order_id}` mostrando # de pedido, items, total, ETA por artesano, confirmación de email enviado. Para guests, link incluye token firmado para reacceso. Esta página será reusada como detalle de pedido en Phase 4.
- **D-24:** Email transaccional de confirmación de pago se dispara desde el webhook (Resend). Templates específicos de transiciones de estado se definen en Phase 4; esta fase entrega el `order-confirmed.tsx` mínimo.

### Crypto Payment
- **D-25:** **Diferido**. Coinbase Commerce no se integra en Phase 3. Scaffolds `payment-crypto.tsx`, `webhooks/coinbase` quedan vacíos. UI checkout solo muestra Stripe (tarjeta). Crypto se planifica como fase futura.

### Claude's Discretion
- Estructura URL exacta de `/carrito` y query params del checkout
- Diseño visual del cart sheet (animaciones, badge contador en header)
- Stripe Elements UI customization (theme matching brand)
- Copy exacto de disclaimers y mensajes de error de cupón/stock
- Manejo de retry de pago fallido (UI feedback)
- Estructura del email `order-confirmed.tsx` (template inicial)
- Cron/cleanup de carritos abandonados (no requerido esta fase)
- Implementación de magic-link para guest order access
- Diseño de empty state del carrito
- Agrupación visual por artesano en cart sheet vs carrito page

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Flujo de Compra y Pago
- `docs/flow_purchase.html` — Flujo completo de compra: carrito, checkout, requisitos auth en checkout
- `docs/flow_split_payment.html` — **OBSOLETO en partes** (describe Stripe Connect). Leer solo para entender flujo conceptual de comisión; ignorar referencias a `transfers.create` y Express accounts. Reemplazado por single-account model (D-SPLIT)

### Schema y State Machine
- `docs/erd_core.html` — ERD: tablas `order`, `order_item`, `payment`, `artisan_payout`, `shipment`, `shipping_address`, `coupon`, `commission_config`, `webhook_idempotency`. **Nota:** `payment.stripe_transfer_id` queda nullable y sin uso (single-account, sin transfers). `artisan_payout` cobra protagonismo como ledger contable interno.
- `supabase/migrations/003_config.sql` — Schema de `coupon` y `commission_config`
- `supabase/migrations/005_commerce.sql` — Schema de `order`, `order_item`, `payment`, `artisan_payout`, `shipment`, `shipping_address`
- `supabase/migrations/007_webhook_idempotency.sql` — Tabla idempotencia webhooks
- `supabase/migrations/008_state_machines.sql` — Funciones de transición de estado de pedido

### Architecture y API
- `docs/architecture.html` — Patrones de integración Supabase, Stripe Connect, webhooks
- `docs/api_spec.html` — Endpoints `/api/webhooks/stripe`, `/api/couriers/quote`, `/api/currency`

### Utilities y Constants
- `src/lib/utils/commission.ts` — Cálculo de comisión y split (entregado en Phase 1)
- `src/lib/utils/constants.ts` — `ORDER_STATUSES`, `MAX_PHOTOS_PER_PRODUCT`, configuración

### Project Structure
- `docs/project_structure.md` — Layout de directorios, convenciones
- `docs/testing_strategy.md` — Estrategia E2E para flujos de pago

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (scaffolds vacíos a implementar)
- `src/store/cart.store.ts` — Zustand store del carrito (vacío)
- `src/components/cart/cart-sheet.tsx` — Sheet slide-over (vacío)
- `src/components/cart/cart-item.tsx` — Item individual del carrito (vacío)
- `src/components/checkout/checkout-form.tsx` — Form principal de checkout (vacío)
- `src/components/checkout/order-summary.tsx` — Resumen sticky (vacío)
- `src/components/checkout/payment-stripe.tsx` — Stripe Elements wrapper (vacío)
- `src/components/checkout/payment-crypto.tsx` — Coinbase (vacío, **diferido D-25**)
- `src/lib/stripe/client.ts` — Cliente Stripe (vacío)
- `src/lib/stripe/split.ts` — **Renombrar/repropósito**: ya NO contiene `transfers.create`. Pasa a contener helpers de cálculo contable que producen filas `artisan_payout` (in-memory) listas para insertar. Considerar renombrar a `src/lib/stripe/payout-ledger.ts` durante planning.
- `src/lib/couriers/index.ts` — Interface unificada de couriers (vacío)
- `src/lib/couriers/chilexpress.ts` — Adaptador Chilexpress (vacío)
- `src/lib/couriers/starken.ts` — Adaptador Starken (vacío)
- `src/lib/couriers/dhl.ts`, `fedex.ts` — **Diferidos D-13** (no usar Phase 3)
- `src/app/api/webhooks/stripe/route.ts` — Handler webhook (4 líneas placeholder)
- `src/app/api/webhooks/coinbase/` — **Diferido D-25**
- `src/app/api/couriers/` — Endpoint quote (estructura existe)
- `src/components/ui/sheet.tsx` — Sheet primitive (de Phase 2, reusable)
- `src/lib/cloudinary/` — No relevante esta fase

### Established Patterns
- Supabase Auth + cookie sessions (`@supabase/ssr`)
- Zustand para client state (cart store sigue patrón de `currency.store.ts`)
- Server actions / route handlers con validación Zod (CLAUDE.md)
- next-intl para i18n (es default, en estructura mínima)
- `@/` path alias → `src/`
- Layout-level auth guards (no aplica a checkout — debe permitir guests)

### Integration Points
- `src/app/[locale]/` — Rutas públicas: `/carrito`, `/checkout`, `/pedido/{id}`
- `src/components/header/` — Botón carrito con badge contador (a verificar/agregar)
- Tablas Phase 1 ya existen: `order`, `order_item`, `payment`, `shipment`, `shipping_address`, `coupon`, `webhook_idempotency`
- Catálogo Phase 2 expone `product` + `product_variant` con stock — checkout consulta estos
- `src/types/database.types.ts` — Tipos auto-generados disponibles
- `middleware.ts` — i18n + session refresh (no requiere cambios)

</code_context>

<specifics>
## Specific Ideas

- **Modelo familiar protegido:** la plataforma absorbe descuentos de cupones para no afectar el ingreso del artesano (D-15). Coherente con la decisión de Phase 1 de admin-only artisan creation y la confianza del modelo familiar.
- **Single PaymentIntent siempre:** UX limpia para el comprador (un solo cargo en su estado de cuenta) aunque internamente la plataforma haga N transfers a artesanos.
- **Per-artisan shipment desde checkout:** sienta las bases para Phase 4 donde cada artesano gestiona su propio shipment independientemente.

</specifics>

<deferred>
## Deferred Ideas

- **Coinbase Commerce / crypto payment** — fase futura (post Phase 5)
- **Envío internacional (DHL, FedEx)** — fase futura
- **CRUD completo admin de cupones** — Phase 5 (Dashboards & Operations); esta fase puede requerir un mínimo para QA (a definir en planning)
- **Soft-reserve de stock con TTL** — optimización futura si oversell se vuelve problema real
- **Carrito sincronizado a DB para logged users** — futura mejora UX cross-device
- **Galería pública de cupones / auto-apply** — fuera de alcance
- **Express checkout (Apple Pay / Google Pay / saved cards)** — requiere infra de payment methods guardados; defer
- **Manejo avanzado de refunds y splits inversos** — Phase 4 o posterior

</deferred>

---

*Phase: 03-commerce*
*Context gathered: 2026-05-09*
