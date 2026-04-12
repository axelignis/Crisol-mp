# Feature Research

**Domain:** Artisanal jewelry multi-vendor marketplace (LATAM-origin, international reach)
**Researched:** 2026-04-12
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Product catalog with filtering | Every e-commerce site has this. Buyers filter by type, material, price range, occasion. Without it, discovery is broken. | MEDIUM | SSG/ISR pages with faceted filters. RF-04. Need category/tag taxonomy from day one. |
| High-quality product imagery | Jewelry is a visual purchase. Multiple angles, zoom, lifestyle shots are non-negotiable. Buyers cannot touch the product. | MEDIUM | Cloudinary auto-optimization. RF-02 specifies max 10 photos. Cover image + gallery pattern. |
| Artisan profiles with storytelling | Handmade buyers pay for the story behind the maker. 78% pay premium for pieces with narrative. Novica, Etsy, Catbird all center artisan identity. | LOW | Public profile with bio, photo, social links, portfolio of sold pieces. RF-04 artisan URL. |
| Secure checkout with guest option | Cart abandonment spikes without guest checkout. Forcing registration before purchase loses 25-35% of buyers. | HIGH | Multi-artisan cart, shipping address, courier quote, payment. RF-06. Most complex flow in the system. |
| Split payment (marketplace commission) | Core business model. Without automated commission split, the marketplace cannot function. Manual transfers do not scale. | HIGH | Stripe Connect with configurable commission %. RF-07. Webhook idempotency critical. |
| Order lifecycle with email notifications | Buyers expect to know what is happening with their order. Artisans need to manage fulfillment. | MEDIUM | State machine: pending_payment -> paid -> in_preparation -> shipped -> delivered. RF-09 + RF-15. |
| Shipping integration with real-time quotes | Shipping cost is a top purchase decision factor. Manual "we'll email you the cost" kills conversion. | HIGH | 4 courier APIs (Chilexpress, Starken, DHL, FedEx). RF-08. Complex but essential for international marketplace. |
| Mobile-responsive design | 60%+ of jewelry browsing happens on mobile. Non-responsive = invisible to majority of traffic. | MEDIUM | Tailwind responsive-first. Not a separate feature, but a constraint on every UI decision. |
| Role-based access control | Multi-vendor marketplace needs strict separation: artisan sees own data, admin sees everything, buyer sees purchases. | MEDIUM | Supabase RLS + JWT role claims. Foundation for every other feature. |
| Product variants (size, material, color) | Jewelry inherently has variants: ring sizes, metal types, stone options. Without variants, each combination is a separate listing. | MEDIUM | RF-01 PRODUCT_VARIANT with stock and price modifier. |
| Admin approval workflow for listings | Quality control is what separates a curated marketplace from a flea market. Etsy struggles with this; Novica excels because of curation. | MEDIUM | RF-03 state machine: draft -> pending_review -> published. Admin approves/rejects with feedback. |
| Artisan dashboard (orders, balance, products) | Artisans need self-service tools or they constantly message the admin. Panel must show sales, pending orders, commission breakdown, balance. | HIGH | RF-11. Multiple views: product management, order management, financial summary. |
| Admin dashboard (overview, artisan management) | Platform operator needs visibility into sales, commissions, pending approvals, artisan performance. | HIGH | RF-12. Reporteria, artisan management, catalog oversight, configuration. |
| Transactional emails | Confirmation, shipping updates, approval notifications. Without these, users feel lost and flood support channels. | LOW | Resend + React Email templates. RF-15. Standard patterns, well-documented. |
| No-returns policy display | Crisol-specific: handmade items are non-returnable. Must be explicit at checkout to avoid chargebacks and disputes. | LOW | Legal notice in checkout flow, confirmation page, and order emails. Not optional for this domain. |

### Differentiators (Competitive Advantage)

Features that set Crisol apart from generic Etsy/Amazon Handmade competitors.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Hybrid brand identity (unified Crisol + artisan profiles) | Unlike Etsy where each seller is isolated, Crisol presents a curated family brand with individual artisan visibility. This builds trust faster than individual unknown sellers. | LOW | Design/UX decision more than technical. Consistent brand wrapper around artisan content. |
| 3D model viewer for pieces | Lets buyers inspect jewelry from all angles. Very few handmade marketplaces offer this. Reduces "it looked different" complaints. | LOW | @google/model-viewer is a web component -- drop-in. RF-02. The hard part is artisans creating 3D models. |
| Sold pieces as portfolio | Most marketplaces hide sold items. Keeping them visible as artisan portfolio showcases range, builds trust, and improves SEO with more indexed pages. | LOW | Product status "sold" remains publicly visible. Already in RF-01 spec. Minimal extra work. |
| Coupons and promotions system | Enables marketing campaigns, seasonal sales, influencer codes. Not every small marketplace has this at launch. | MEDIUM | RF-18. COUPON entity with type (% or fixed), usage limits, expiration. Applied at checkout. |
| Configurable commission with version history | Admin can adjust commission % over time with full audit trail. Most small marketplaces hardcode this. | LOW | RF-19. COMMISSION_CONFIG table with immutable version history. Already designed in ERD. |
| Commission slot system (custom orders) | Artisans publish available slots for custom work with price/timeline. Rare in small marketplaces. Captures high-value custom jewelry market. | MEDIUM | RF-05. v2 feature per PROJECT.md scope. Deferred but designed in data model. |
| Bilingual architecture (es/en) from day one | Most LATAM marketplaces are Spanish-only. Having i18n baked in from architecture level (not bolted on) enables international reach without rewrite. | LOW | next-intl already scaffolded. Es default, en structure exists. RF-16. |
| CLP + USD display pricing | Chilean artisans price in CLP, international buyers see USD. Removes friction for both sides. | LOW | RF-17. Display-only conversion via /api/currency. CLP canonical, USD never persisted. v2 for real-time rates. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time chat between buyer and artisan | "Customers want to ask questions before buying" | Requires always-on infrastructure (WebSockets), moderation, abuse prevention, notification system. For 4-6 artisans, response times will be poor, creating worse UX than no chat. Chat is a support burden that scales badly. | Contact form or email inquiry per product. Artisan responds via email. Async is fine for considered purchases like jewelry. |
| OAuth social login (Google, GitHub, Facebook) | "Everyone expects social login" | Adds OAuth provider maintenance, consent screens, data privacy compliance (GDPR), and edge cases (email conflicts, account linking). For a niche marketplace with low registration friction, email/password is sufficient. | Email + password via Supabase Auth. Add social login in v2 only if registration conversion data shows a problem. |
| User-generated content beyond reviews | "Let buyers post photos wearing the jewelry" | Content moderation burden, storage costs, legal liability for user-uploaded content. Small team cannot moderate at scale. | Curated "customer spotlight" section managed by admin. Encourage social media sharing with branded hashtag instead. |
| Real-time inventory sync across channels | "Sell on Etsy + Crisol simultaneously" | Multi-channel inventory sync is a whole product category (ChannelEngine, Sellbrite). Introduces race conditions, overselling risk, and massive integration complexity. | Crisol is the primary channel. If artisans also sell on Etsy, they manage inventory manually. Revisit only if artisans operate at scale. |
| Complex discount rules engine | "Buy 2 get 1 free, bundle discounts, tiered pricing" | Rule engines become unmaintainable quickly. Edge cases multiply (what if coupon + bundle + loyalty points?). For unique handmade pieces, complex promotions are rarely needed. | Simple coupon codes (% or fixed amount) with usage limits. One coupon per order. No stacking. RF-18 is correctly scoped. |
| AI-powered recommendation engine | "Show personalized recommendations" | Requires significant purchase data to train. With 4-6 artisans and hundreds of unique pieces (many one-of-a-kind), there is not enough data for meaningful recommendations. Cold start problem is severe. | "Related pieces by same artisan" and "Similar materials/techniques" -- simple attribute-based suggestions, not ML. |
| Auction/bidding system | "Let buyers bid on unique pieces" | Adds massive complexity: bid management, sniping protection, payment holds, failed auction handling. Incompatible with the curated, fixed-price brand positioning. | Fixed pricing. For high-value unique pieces, the artisan sets the price. Custom orders via commission slots handle the "negotiation" use case. |
| Native mobile app | "Everyone uses apps" | Development cost 2-3x web. Maintenance of two codebases. App store approval process. For a marketplace with <100 SKUs initially, a PWA-capable responsive web app covers 95% of use cases. | Responsive web with PWA capabilities (offline product browsing, add-to-home-screen). Already in stack via Next.js. |
| Cryptocurrency payments at launch | "Crypto is the future" | Coinbase Commerce adds another payment webhook flow, reconciliation complexity, volatility handling, and regulatory gray areas. For v1 with 4-6 artisans, Stripe covers 99% of buyers. | Defer to v2 (already in PROJECT.md out-of-scope). Add only after Stripe flow is battle-tested. |
| Full blog/CMS at launch | "Content marketing from day one" | Blog requires editorial workflow, rich text editor, SEO optimization, and ongoing content creation commitment. Without dedicated content creators, blogs become graveyards of 3 posts. | Focus v1 on product pages and artisan profiles as content. Artisan stories ARE the content. Blog in v2 when there is editorial capacity. |

## Feature Dependencies

```
[Auth + Roles]
    |-- requires --> [Database migrations + RLS]
    |-- enables --> [Artisan dashboard]
    |-- enables --> [Admin dashboard]
    |-- enables --> [Buyer account]

[Product catalog]
    |-- requires --> [Database migrations]
    |-- requires --> [Media upload (Cloudinary)]
    |-- requires --> [Category/tag taxonomy]
    |-- enables --> [Search and filtering]
    |-- enables --> [Product detail pages]

[Admin approval workflow]
    |-- requires --> [Product catalog]
    |-- requires --> [Auth + Roles (admin)]
    |-- requires --> [Email notifications]

[Checkout flow]
    |-- requires --> [Cart (Zustand store)]
    |-- requires --> [Product catalog (stock check)]
    |-- requires --> [Shipping integration (courier quotes)]
    |-- requires --> [Payment integration (Stripe Connect)]

[Split payment]
    |-- requires --> [Stripe Connect onboarding for artisans]
    |-- requires --> [Commission config]
    |-- requires --> [Order creation]

[Order lifecycle]
    |-- requires --> [Checkout flow (order creation)]
    |-- requires --> [Email notifications (state change alerts)]
    |-- enables --> [Artisan order management]
    |-- enables --> [Buyer order history]

[Shipping integration]
    |-- requires --> [Courier API integrations]
    |-- requires --> [Artisan address data]
    |-- enables --> [Checkout (shipping quote step)]

[Coupons]
    |-- requires --> [Checkout flow]
    |-- independent of --> [Shipping, Payments]

[Product variants]
    |-- requires --> [Product catalog]
    |-- affects --> [Cart (variant selection)]
    |-- affects --> [Checkout (stock per variant)]
    |-- affects --> [Order items (variant snapshot)]
```

### Dependency Notes

- **Checkout requires Shipping + Payments:** Cannot build checkout without both courier quote and payment processing working. These are the two hardest integrations and gate the entire purchase flow.
- **Split payment requires Stripe Connect onboarding:** Artisans must have connected Stripe accounts before any sale can process. Onboarding flow must exist before first transaction.
- **Admin approval requires Email:** Without notification, artisans have no idea their piece was approved/rejected. Email is a prerequisite for the approval workflow to function.
- **Product variants affect the entire commerce chain:** Variants touch catalog display, cart, checkout, stock management, and order snapshots. Must be designed into the data model from migration phase, not bolted on later.

## MVP Definition

### Launch With (v1)

Minimum viable product: a buyer can discover, purchase, and receive an artisanal piece.

- [ ] Database migrations with RLS (22 entities) -- foundation for everything
- [ ] Auth with role-based guards (admin, artisan, buyer) -- access control
- [ ] Product catalog with filtering (type, material, price, occasion) -- discovery
- [ ] Product media upload via Cloudinary (photos, cover image) -- visual trust
- [ ] Product variants (size, material, color with stock/price) -- jewelry-essential
- [ ] Admin approval workflow (draft -> pending_review -> published) -- quality control
- [ ] Artisan public profiles with SEO-friendly URLs -- storytelling and trust
- [ ] Cart with Zustand (guest + registered, multi-artisan) -- purchase intent
- [ ] Checkout with shipping quote + no-returns notice -- conversion
- [ ] Stripe Connect payment with automatic split -- revenue engine
- [ ] Courier integration: Chilexpress + Starken (national) -- domestic shipping
- [ ] Order lifecycle with state machine -- fulfillment tracking
- [ ] Transactional emails (order confirmation, status changes, approval) -- communication
- [ ] Artisan dashboard (products, orders, balance) -- self-service
- [ ] Admin dashboard (approvals, artisan management, basic reports, config) -- platform operation
- [ ] Commission config (versioned, admin-editable) -- business model

### Add After Validation (v1.x)

Features to add once core purchase flow is proven and first sales occur.

- [ ] Coupons and promotions (RF-18) -- add when marketing campaigns begin
- [ ] International shipping: DHL + FedEx -- add when international demand is confirmed
- [ ] 3D model viewer (@google/model-viewer) -- add when artisans produce 3D assets
- [ ] CLP/USD display toggle -- add when international traffic justifies it
- [ ] English locale content -- add when en translations are written

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Loyalty points and membership tiers (RF-10) -- requires purchase volume data to design meaningful tiers
- [ ] Verified reviews with moderation (RF-13) -- requires completed orders to exist
- [ ] Favorites and artisan following (RF-13) -- engagement feature, not conversion feature
- [ ] Commission slots for custom orders (RF-05) -- complex flow, validate demand first
- [ ] Blog/editorial section (RF-14) -- requires editorial commitment and content pipeline
- [ ] Coinbase Commerce crypto payments (RF-07) -- adds reconciliation complexity for marginal buyer segment
- [ ] Web Push notifications (RF-15) -- email covers v1; push adds browser permission fatigue
- [ ] Advanced SEO: Schema.org full suite, AEO, llms.txt (SEO strategy) -- meaningful only with indexed catalog
- [ ] GA4 + Search Console API in admin (monitoring) -- manual dashboards sufficient for v1
- [ ] Pinterest/Instagram Shopping feeds -- requires stable product catalog and media pipeline

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Database migrations + RLS | HIGH | HIGH | P1 |
| Auth with roles | HIGH | MEDIUM | P1 |
| Product catalog + filtering | HIGH | MEDIUM | P1 |
| Product media (Cloudinary) | HIGH | MEDIUM | P1 |
| Product variants | HIGH | MEDIUM | P1 |
| Admin approval workflow | HIGH | MEDIUM | P1 |
| Artisan profiles | HIGH | LOW | P1 |
| Cart (Zustand) | HIGH | MEDIUM | P1 |
| Checkout flow | HIGH | HIGH | P1 |
| Stripe Connect split payment | HIGH | HIGH | P1 |
| National shipping (Chilexpress/Starken) | HIGH | HIGH | P1 |
| Order lifecycle + state machine | HIGH | MEDIUM | P1 |
| Transactional emails | HIGH | LOW | P1 |
| Artisan dashboard | HIGH | HIGH | P1 |
| Admin dashboard | HIGH | HIGH | P1 |
| Commission config | MEDIUM | LOW | P1 |
| Coupons/promotions | MEDIUM | MEDIUM | P2 |
| International shipping (DHL/FedEx) | MEDIUM | HIGH | P2 |
| 3D model viewer | LOW | LOW | P2 |
| CLP/USD display | MEDIUM | LOW | P2 |
| English locale | MEDIUM | LOW | P2 |
| Loyalty/membership | MEDIUM | HIGH | P3 |
| Reviews | MEDIUM | MEDIUM | P3 |
| Favorites/following | LOW | LOW | P3 |
| Commission slots (custom orders) | MEDIUM | HIGH | P3 |
| Blog/CMS | LOW | MEDIUM | P3 |
| Crypto payments | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- the purchase flow does not work without these
- P2: Should have, add post-launch when conditions are met
- P3: Nice to have, defer until product-market fit established

## Competitor Feature Analysis

| Feature | Etsy | Novica | Amazon Handmade | Crisol Approach |
|---------|------|--------|-----------------|-----------------|
| Artisan storytelling | Seller profiles, but buried under listings and ads | Central -- detailed artisan bios, impact stories, fair trade narrative | Minimal -- Amazon brand dominates | Hybrid brand: Crisol identity wraps artisan profiles. Artisan story is first-class, not buried. |
| Product curation | None -- anyone can list anything, quality varies wildly | Strong -- each artisan is vetted, every piece reviewed | Minimal -- self-service listing | Admin approval workflow ensures every piece meets quality bar before publication. |
| Search/discovery | Powerful but noisy -- SEO-gamed titles, promoted listings, ads | Category-based browsing, curated collections | Amazon search algorithm (not craft-optimized) | Clean faceted filters (type, material, price, occasion, technique). No promoted listings polluting results. |
| Payment model | Listing fee + transaction fee + payment processing | Direct purchase, Novica handles payment and shipping | Amazon payment processing | Stripe Connect split: configurable commission auto-deducted. Artisan sees net payout. |
| Shipping | Seller-managed, highly variable | Novica handles logistics centrally | FBA or seller-fulfilled | Artisan-fulfilled with automated courier quotes. Each artisan ships their own pieces. |
| Custom orders | Messaging-based, no structured flow | Limited custom options | Not supported | v2: Structured commission slots with price, timeline, and availability. |
| Reviews | Extensive -- star ratings + text + photos | Reviews present but less prominent | Amazon review system | v2: Verified reviews (must have completed order). No anonymous reviews. |
| Mobile experience | Dedicated app + responsive web | Responsive web | Amazon app | Responsive web only. PWA capabilities for add-to-home-screen. |
| Internationalization | Multi-language, multi-currency | Multi-language, USD-centric | Multi-language via Amazon | Bilingual (es/en) architecture. CLP canonical, USD display. |
| Media quality | Up to 10 photos, video | High-quality photography | Standard Amazon listing | Up to 10 photos + 1 video + 1 3D model. Cloudinary auto-optimization. |

## Sources

- [Where to Buy Handmade Jewelry: 11 Top Sites & Trends for 2026](https://lefkarasilver.com/handmade-jewelry/) -- competitor landscape
- [2025 Handmade Jewelry Trends: Growth, Preferences & Forecasts](https://www.accio.com/business/trend-of-handmade-jewelry-in-2025) -- market trends
- [40 Essential Features for a Multi Vendor Marketplace](https://www.shipturtle.com/blog/features-to-build-multi-vendor-marketplace) -- marketplace feature checklist
- [16 Website Tips For Your Handmade Jewellery Business](https://www.kernowcraft.com/blog/handmade-jewellery-business-tips/16-website-tips-for-your-handmade-jewellery-business) -- trust signals
- [Amazon Handmade vs Etsy: Comparing Marketplaces](https://www.swagify.com/blog/amazon-handmade-vs-etsy/) -- competitor comparison
- [4 Handy Tips For Exploring NOVICA's Artisan Marketplace](https://www.novica.com/blog/_-great-tips-for-exploring-our-marketplace/) -- Novica feature analysis
- [Mastering e-Commerce Strategy: A Guide for Jewelry Stores](https://jewel360.com/blog/e-commerce-strategy) -- jewelry e-commerce patterns
- Crisol project documentation: `docs/master.html`, `.planning/PROJECT.md` -- existing requirements (RF-01 to RF-19, 30 use cases)

---
*Feature research for: Artisanal jewelry multi-vendor marketplace*
*Researched: 2026-04-12*
