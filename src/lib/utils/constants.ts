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
