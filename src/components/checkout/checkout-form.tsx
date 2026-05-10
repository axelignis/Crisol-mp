'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCart } from '@/hooks/use-cart'
import { CheckoutContact } from './checkout-contact'
import { CheckoutAddress, type AddressValue } from './checkout-address'
import { CheckoutShipping, type ShippingSelection } from './checkout-shipping'
import { CheckoutCoupon } from './checkout-coupon'
import { CheckoutDisclaimers } from './checkout-disclaimers'
import { OrderSummary } from './order-summary'
import { PaymentStripe } from './payment-stripe'

type Props = {
  locale: string
  initialEmail?: string
  buyerId: string | null
}

const emptyAddress: AddressValue = {
  fullName: '',
  line1: '',
  line2: '',
  city: '',
  region: '',
  countryCode: 'CL',
  postalCode: '',
  phone: '',
}

export function CheckoutForm({ locale, initialEmail, buyerId }: Props) {
  const router = useRouter()
  const t = useTranslations('checkout')
  const { items, count, subtotal, byArtisan } = useCart()

  const [email, setEmail] = useState(initialEmail ?? '')
  const [address, setAddress] = useState<AddressValue>(emptyAddress)
  const [shipping, setShipping] = useState<ShippingSelection[]>([])
  const [shippingLoading, setShippingLoading] = useState(false)
  const [couponCode, setCouponCode] = useState<string | null>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [accepted, setAccepted] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [snapshotId, setSnapshotId] = useState<string | null>(null)
  const [piLoading, setPiLoading] = useState(false)
  const [piError, setPiError] = useState<string | null>(null)

  // Si carrito vacío → redirect carrito
  useEffect(() => {
    if (count === 0) {
      const timer = setTimeout(() => {
        router.replace(`/${locale}/carrito`)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [count, locale, router])

  const shippingTotal = useMemo(() => shipping.reduce((s, x) => s + x.costClp, 0), [shipping])
  const total = Math.max(0, subtotal - couponDiscount) + shippingTotal

  async function handleQuoteShipping() {
    setShippingLoading(true)
    try {
      // Consulta /api/couriers/quote per artesano. Si falla, usa flat_rate display.
      const groups = byArtisan.map((g) => ({
        artisanId: g.artisanId,
        origin: { region: 'metropolitana', comuna: 'santiago' },
        package: { weightKg: 1, lengthCm: 20, widthCm: 15, heightCm: 10 },
      }))
      const res = await fetch('/api/couriers/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: { region: address.region || 'metropolitana', comuna: address.city || 'santiago', countryCode: 'CL' },
          groups,
        }),
      })
      if (!res.ok) {
        // Fallback flat_rate por artesano
        setShipping(byArtisan.map((g) => ({ artisanId: g.artisanId, artisanName: g.artisanName, courier: 'flat_rate', costClp: 5990 })))
        return
      }
      const json = await res.json()
      type Q = { artisanId: string; quote: { source: 'chilexpress' | 'starken' | 'flat_rate'; costClp: number } }
      const sel: ShippingSelection[] = json.quotes.map((q: Q) => {
        const grp = byArtisan.find((g) => g.artisanId === q.artisanId)
        return {
          artisanId: q.artisanId,
          artisanName: grp?.artisanName ?? '',
          courier: q.quote.source,
          costClp: q.quote.costClp,
        }
      })
      setShipping(sel)
    } finally {
      setShippingLoading(false)
    }
  }

  const formValid =
    email.length > 3 &&
    address.fullName.trim().length >= 2 &&
    address.line1.trim().length >= 3 &&
    address.city.trim().length > 0 &&
    address.region.trim().length > 0
  const payable = formValid && shipping.length === byArtisan.length && accepted && byArtisan.length > 0

  async function handleInitiatePay() {
    setPiLoading(true)
    setPiError(null)
    try {
      const res = await fetch('/api/checkout/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          buyer_id: buyerId,
          items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
          address: {
            fullName: address.fullName,
            line1: address.line1,
            line2: address.line2 || undefined,
            city: address.city,
            region: address.region,
            countryCode: 'CL',
            postalCode: address.postalCode || undefined,
            phone: address.phone || undefined,
          },
          shipments: shipping.map((s) => ({ artisanId: s.artisanId, courier: s.courier, costClp: s.costClp })),
          couponCode: couponCode ?? undefined,
          acceptedDisclaimers: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setPiError(json.error ?? 'server_error')
        return
      }
      setClientSecret(json.clientSecret)
      setSnapshotId(json.snapshotId)
    } catch (e) {
      setPiError('network_error')
    } finally {
      setPiLoading(false)
    }
  }

  if (count === 0) {
    return <p className="p-8 text-sm text-zinc-500">Carrito vacío — redirigiendo...</p>
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <CheckoutContact email={email} onChange={setEmail} readOnly={!!initialEmail && !!buyerId} />
        <CheckoutAddress value={address} onChange={setAddress} />
        <CheckoutShipping
          selections={shipping}
          onQuoteRequest={handleQuoteShipping}
          loading={shippingLoading}
        />
        <CheckoutCoupon
          subtotal={subtotal}
          appliedCode={couponCode}
          appliedDiscount={couponDiscount}
          onApply={(c, d) => { setCouponCode(c); setCouponDiscount(d) }}
          onClear={() => { setCouponCode(null); setCouponDiscount(0) }}
        />
        <CheckoutDisclaimers accepted={accepted} onChange={setAccepted} />
        {piError && <p className="text-sm text-red-600">{t('payment.error')}: {piError}</p>}
        <PaymentStripe
          clientSecret={clientSecret}
          onConfirm={handleInitiatePay}
          returnUrl={typeof window !== 'undefined' ? `${window.location.origin}/${locale}/checkout/confirmacion?snapshot=${snapshotId ?? ''}` : ''}
          disabled={false}
          payable={payable}
          loading={piLoading}
        />
      </div>
      <OrderSummary
        itemsCount={count}
        subtotal={subtotal}
        discount={couponDiscount}
        shippingTotal={shippingTotal}
        total={total}
      />
    </div>
  )
}
