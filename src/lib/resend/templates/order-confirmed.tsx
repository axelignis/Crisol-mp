/**
 * Phase 3 Plan 06 — Email "order-confirmed" (React Email).
 *
 * Se renderiza desde sendOrderConfirmedEmail(). Soporta logged buyer
 * (sin magic-link) y guest (con magic-link firmado HMAC).
 */
import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Section,
  Hr,
  Button,
  Preview,
} from '@react-email/components'

export type OrderConfirmedItem = {
  snapshot_title: string
  unit_price: number
  quantity: number
  artisan_id: string
}

export type OrderConfirmedShipment = {
  courier: string
  estimated_delivery: string | null
  artisan_id: string
}

export type OrderConfirmedAddress = {
  full_name: string
  line1: string
  city: string
  region: string
}

export type OrderConfirmedOrder = {
  id: string
  total: number
  subtotal: number
  shipping_cost: number
  discount_amount: number
  created_at: string
  order_item: OrderConfirmedItem[]
  shipping_address: OrderConfirmedAddress | null
  shipment: OrderConfirmedShipment[]
}

export type OrderConfirmedEmailProps = {
  order: OrderConfirmedOrder
  /** Si presente, se incluye CTA con magic-link (guest flow). */
  magicLinkToken?: string
  /** URL completa al detalle. Si no se pasa se construye con NEXT_PUBLIC_SITE_URL. */
  magicLinkUrl?: string
}

const formatCLP = (n: number) =>
  `$${Math.round(n).toLocaleString('es-CL')} CLP`

export function OrderConfirmedEmail({
  order,
  magicLinkToken,
  magicLinkUrl,
}: OrderConfirmedEmailProps) {
  const shortId = order.id.slice(0, 8)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://crisol.cl'
  const detailUrl =
    magicLinkUrl ??
    (magicLinkToken
      ? `${baseUrl}/es/pedido/${order.id}?token=${magicLinkToken}`
      : `${baseUrl}/es/pedido/${order.id}`)

  return (
    <Html lang="es">
      <Head />
      <Preview>Confirmacion de tu pedido en Crisol</Preview>
      <Body style={{ backgroundColor: '#f5f5f5', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '24px', maxWidth: '600px' }}>
          <Heading style={{ color: '#111', fontSize: '22px' }}>¡Gracias por tu compra!</Heading>
          <Text style={{ color: '#444' }}>
            Tu pedido <strong>#{shortId}</strong> fue confirmado el{' '}
            {new Date(order.created_at).toLocaleDateString('es-CL')}.
          </Text>

          <Hr />

          <Section>
            <Heading as="h2" style={{ fontSize: '16px', color: '#111' }}>
              Detalle
            </Heading>
            {order.order_item.map((item, i) => (
              <Text key={i} style={{ margin: '4px 0', color: '#333' }}>
                {item.quantity}× {item.snapshot_title} — {formatCLP(item.unit_price * item.quantity)}
              </Text>
            ))}
          </Section>

          <Hr />

          <Section>
            <Text style={{ color: '#333' }}>Subtotal: {formatCLP(order.subtotal)}</Text>
            <Text style={{ color: '#333' }}>Envío: {formatCLP(order.shipping_cost)}</Text>
            {order.discount_amount > 0 && (
              <Text style={{ color: '#333' }}>Descuento: -{formatCLP(order.discount_amount)}</Text>
            )}
            <Text style={{ color: '#111', fontWeight: 'bold' }}>
              Total: {formatCLP(order.total)}
            </Text>
          </Section>

          {order.shipment.length > 0 && (
            <>
              <Hr />
              <Section>
                <Heading as="h2" style={{ fontSize: '16px', color: '#111' }}>
                  Envíos
                </Heading>
                {order.shipment.map((s, i) => (
                  <Text key={i} style={{ color: '#333', margin: '4px 0' }}>
                    {s.courier}
                    {s.estimated_delivery ? ` — entrega estimada ${s.estimated_delivery}` : ''}
                  </Text>
                ))}
              </Section>
            </>
          )}

          {order.shipping_address && (
            <>
              <Hr />
              <Section>
                <Heading as="h2" style={{ fontSize: '16px', color: '#111' }}>
                  Dirección
                </Heading>
                <Text style={{ color: '#333' }}>
                  {order.shipping_address.full_name}
                  <br />
                  {order.shipping_address.line1}
                  <br />
                  {order.shipping_address.city}, {order.shipping_address.region}
                </Text>
              </Section>
            </>
          )}

          <Hr />

          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button
              href={detailUrl}
              style={{
                backgroundColor: '#111',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '4px',
                textDecoration: 'none',
              }}
            >
              Ver mi pedido
            </Button>
          </Section>

          <Hr />

          <Text style={{ fontSize: '12px', color: '#777' }}>
            Recordatorio: las piezas son artesanales y únicas. No se aceptan devoluciones salvo
            defecto de fábrica. El despacho lo realiza directamente cada artesano.
          </Text>
          <Text style={{ fontSize: '12px', color: '#777' }}>Crisol — Marketplace de orfebrería</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default OrderConfirmedEmail
