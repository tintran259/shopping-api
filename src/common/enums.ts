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

/** Authorization role. `customer` = storefront; `admin` = back-office staff
 *  (quyền giới hạn theo StaffRole được gán); `super_admin` = toàn quyền, mọi
 *  chi nhánh, quản lý role + tài khoản admin. */
export enum CustomerRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
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

/**
 * Loại thông báo Back Office. Hiện chỉ `ORDER` được triển khai; các loại còn lại
 * khai báo sẵn để Settings + kiến trúc mở rộng cho tương lai (mỗi loại bật/tắt
 * độc lập). Thêm loại mới = thêm builder + recipient resolver trong
 * `AdminNotificationsService`, không đụng phần lõi.
 */
export enum NotificationType {
  ORDER = 'order',
  COMPLAINT = 'complaint',
  REFUND = 'refund',
  INVENTORY = 'inventory',
  PROMOTION = 'promotion',
  CUSTOMER = 'customer',
  PRODUCT = 'product',
  SYSTEM = 'system',
}

export enum ShipmentStatus {
  PENDING = 'pending', // chờ lấy hàng
  SHIPPED = 'shipped', // đã lấy hàng (carrier picked up / at first hub)
  IN_TRANSIT = 'in_transit', // đang vận chuyển
  DELIVERED = 'delivered', // đã giao
  /** Giao không thành công / hàng hoàn về người gửi. A terminal-ish shipment
   *  outcome (distinct from the order's own status) that the admin resolves
   *  by either re-shipping (order back to PROCESSING) or cancelling. */
  RETURNED = 'returned',
  /** Sự cố SAU khi đã giao cho ĐVVC: hàng hư hỏng/mất/hoàn thất bại trong quá
   *  trình vận chuyển — hàng đang ở phía carrier, cần admin xử lý. */
  PROBLEM = 'problem',
  /** Sự cố TRƯỚC khi giao cho ĐVVC: carrier không lấy được hàng — hàng chưa
   *  rời kho. Tách riêng khỏi PROBLEM để timeline không hiển thị các bước vận
   *  chuyển (chưa từng xảy ra); admin giao lại (dễ, hàng còn) hoặc hủy. */
  PICKUP_FAILED = 'pickup_failed',
}

export enum VoucherType {
  PERCENT = 'percent',
  FIXED = 'fixed',
  SHIPPING = 'shipping',
}

/** Who a voucher's customer-facing restriction applies to. `SPECIFIC` with
 *  an empty customers list = no restriction at all (today's default —
 *  anyone, guest or account, can use it); a non-empty list narrows it to
 *  just those accounts. `GUESTS`/`USERS` ignore the specific-customers list
 *  entirely and gate purely on whether the order has a customerId. */
export enum VoucherCustomerScope {
  SPECIFIC = 'specific',
  GUESTS = 'guests',
  USERS = 'users',
}

/** Home-delivery shipping methods a `shipping` voucher can be restricted to
 *  (matches the storefront's `getDeliveryMethods` ids). Pickup is excluded —
 *  it has no fee for a shipping voucher to touch. */
export enum ShippingMethodCode {
  STANDARD = 'standard',
  EXPRESS = 'express',
}

export enum ReviewStatus {
  PENDING = 'pending',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
}

/** Data shape a category-level attribute *definition* expects — this is the
 *  filter template (e.g. "Size" is a SELECT with options S/M/L), distinct
 *  from `ProductAttribute` (a free-form key/value/label already filled in
 *  per product, with no schema behind it). `SELECT`/`MULTISELECT` are the
 *  only types that use `options`. */
export enum CategoryAttributeType {
  TEXT = 'text',
  NUMBER = 'number',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  BOOLEAN = 'boolean',
}
