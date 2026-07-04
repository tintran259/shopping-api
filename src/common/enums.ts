/** Shared domain enums, centralised to avoid cross-module import cycles.
 *  Kept in sync with docs/ecommerce-schema.dbml. */

export enum CustomerType {
  INDIVIDUAL = 'individual',
  B2B = 'b2b',
}

export enum CustomerStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

/** Authorization role (admin = staff/back-office). */
export enum CustomerRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
}

export enum ProductStatus {
  ACTIVE = 'active',
  DRAFT = 'draft',
  PREORDER = 'preorder',
  OUT_OF_STOCK = 'out_of_stock',
  DISCONTINUED = 'discontinued',
}

export enum OptionDisplayType {
  SWATCH = 'swatch',
  PILL = 'pill',
  DROPDOWN = 'dropdown',
}

export enum InventoryStatus {
  IN_STOCK = 'in_stock',
  PREORDER = 'preorder',
  OUT_OF_STOCK = 'out_of_stock',
}

export enum CartStatus {
  ACTIVE = 'active',
  CONVERTED = 'converted',
  ABANDONED = 'abandoned',
}

export enum FulfillmentType {
  DELIVERY = 'delivery',
  PICKUP = 'pickup',
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

/** Where an order's stock currently sits (reserve → commit lifecycle). */
export enum OrderStockStatus {
  /** Held against available stock at placement (quantity not yet reduced). */
  RESERVED = 'reserved',
  /** Physically deducted from quantity (payment captured / delivered). */
  COMMITTED = 'committed',
  /** Hold returned to stock (order cancelled/expired). */
  RELEASED = 'released',
}

/** Mirrors the `payment-method.code` enum in shopping-cms (Strapi). */
export enum PaymentMethodCode {
  BANK_TRANSFER = 'bank_transfer',
  MOMO = 'momo',
  ATM_CARD = 'atm_card',
  COD = 'cod',
}

/** Where an order was placed from — lets the BO tell staff-entered orders
 *  (phone/walk-in/B2B) apart from ones the customer placed themselves. */
export enum OrderChannel {
  STOREFRONT = 'storefront',
  ADMIN = 'admin',
}

export enum ShipmentStatus {
  PENDING = 'pending',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
}

export enum VoucherType {
  PERCENT = 'percent',
  FIXED = 'fixed',
  SHIPPING = 'shipping',
}

export enum ReviewStatus {
  PENDING = 'pending',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
}
