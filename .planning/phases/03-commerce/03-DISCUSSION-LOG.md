# Phase 3: Commerce - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 03-commerce
**Areas discussed:** Cart UX & guest checkout, Multi-artisan split & shipping, Coupons, Checkout flow & disclaimers (incl. crypto)

---

## Cart UX & Guest Checkout

### Q: How should the cart be presented to the user?
| Option | Description | Selected |
|--------|-------------|----------|
| Sheet (slide-over) only | cart-sheet.tsx scaffolded; faster UX | |
| Dedicated /carrito page only | Full page; better for complex carts | |
| Both — sheet + /carrito page | Sheet for quick view, page for full edit | ✓ |

### Q: Guest checkout requirement?
| Option | Description | Selected |
|--------|-------------|----------|
| Guest checkout with email only | Email at checkout; optional account upsell after success | ✓ |
| Account required | Force registration before checkout | |
| Guest allowed but email-verified gate | Magic link verify before pay | |

### Q: Cart persistence?
| Option | Description | Selected |
|--------|-------------|----------|
| localStorage for everyone | Zustand + localStorage per COMR-01 | ✓ |
| localStorage for guests, DB for logged | Cross-device sync | |
| Session storage only | Cleared on tab close | |

### Q: Stock validation timing?
| Option | Description | Selected |
|--------|-------------|----------|
| Add-to-cart + checkout open + payment confirm | Three checkpoints; atomic decrement in webhook | ✓ |
| Only at payment confirm | Lighter; sold-out shown late | |
| Soft-reserve with TTL | Reservation table + cleanup job | |

---

## Multi-Artisan Split & Shipping

### Q: Stripe Connect split approach?
| Option | Description | Selected |
|--------|-------------|----------|
| Separate Charges & Transfers | One PaymentIntent + N Transfers; supports multi-artisan | ✓ |
| Destination charges (transfer_data) | Single artisan only | |
| One PaymentIntent per artisan | Multiple charges; high failure risk | |

### Q: Shipping quote per-artisan or single?
| Option | Description | Selected |
|--------|-------------|----------|
| Per-artisan shipment | Each artisan ships independently with own quote | ✓ |
| Single consolidated quote | One shipping line | |
| Flat rate per order, no integration | Skip live quotes | |

### Q: Courier fallback when API timeouts?
| Option | Description | Selected |
|--------|-------------|----------|
| Flat rate per region from config | Admin-editable, never blocks checkout | ✓ |
| Block checkout, ask buyer to retry | Worst UX | |
| Use last-known cached quote | Complex, defer | |

### Q: International orders in Phase 3?
| Option | Description | Selected |
|--------|-------------|----------|
| Chile-only, intl deferred | DHL/FedEx scaffolds stay empty | ✓ |
| Chile + intl with DHL/FedEx now | Full intl, customs complexity | |
| Allow intl with conservative flat rate | Risk of underquoting | |

---

## Coupons

### Q: What does a coupon discount apply to?
| Option | Description | Selected |
|--------|-------------|----------|
| Subtotal only, never to shipping | Standard, predictable | ✓ |
| Subtotal + shipping | Could zero out small orders | |
| Configurable per coupon | Adds applies_to column | |

### Q: Who absorbs the discount?
| Option | Description | Selected |
|--------|-------------|----------|
| Platform absorbs (commission first, then platform loss) | Artisan always full net; protects family margins | ✓ |
| Artisans absorb pro-rata | Fairer for platform | |
| Configurable per coupon | More UI | |

### Q: Stacking?
| Option | Description | Selected |
|--------|-------------|----------|
| One coupon per order | Single code field | ✓ |
| Multiple coupons stackable | Abuse risk | |

### Q: Coupon visibility?
| Option | Description | Selected |
|--------|-------------|----------|
| Admin-created private codes only | Distribution via admin campaigns | ✓ |
| Public 'available coupons' page | Defeats targeted use | |
| Auto-applied based on rules | Defer | |

---

## Checkout Flow & Disclaimers (incl. Crypto)

### Q: Checkout layout?
| Option | Description | Selected |
|--------|-------------|----------|
| Single page, scroll sections | Sticky summary right; modern e-commerce | ✓ |
| Multi-step wizard (3-4 steps) | Better mobile but more clicks | |
| Express checkout + detail expand | Needs saved-payment infra | |

### Q: Disclaimer placement and acceptance?
| Option | Description | Selected |
|--------|-------------|----------|
| Inline above Pay button + required checkbox | Strongest legal posture | ✓ |
| Modal on first checkout entry | Dismissible, weaker consent | |
| Footer text only, no checkbox | Weakest | |

### Q: Post-payment success page?
| Option | Description | Selected |
|--------|-------------|----------|
| /pedido/{order_id} with full detail + email | Reusable as order detail in Phase 4; magic-link for guests | ✓ |
| Generic 'Gracias' page | Minimal | |
| Redirect to /cuenta/pedidos | Doesn't work for guests | |

### Q: Coinbase / crypto in Phase 3?
| Option | Description | Selected |
|--------|-------------|----------|
| Defer, hide UI | Scope reduction; plan as separate phase | ✓ |
| Include Coinbase Commerce now | Two payment methods, second webhook | |
| Show 'Próximamente' button only | Dead UI | |

---

## Claude's Discretion

- URL/query param structures, visual design of sheet/badge
- Stripe Elements theming
- Error/disclaimer copy exacto
- Email template structure for confirmation
- Cron for abandoned carts (not required this phase)
- Magic-link implementation for guest order access
- Empty states

## Deferred Ideas

- Coinbase Commerce / crypto — fase futura
- Envío internacional (DHL/FedEx) — fase futura
- CRUD completo admin de cupones — Phase 5
- Soft-reserve de stock con TTL — optimización futura
- Carrito sincronizado a DB cross-device — futura mejora
- Express checkout (Apple Pay / Google Pay / saved cards) — defer
- Refunds y splits inversos avanzados — Phase 4+
