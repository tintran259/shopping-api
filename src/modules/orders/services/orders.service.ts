import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AdminNotificationsService } from '../../admin-notifications/admin-notifications.service';
import { BranchesService } from '../../branches/services/branches.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { BranchScopeCtx } from '../../../common/decorators/branch-scope.decorator';
import { PaginatedResult } from '../../../common/dto/paginated-result';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  FulfillmentType,
  InventoryStatus,
  OrderChannel,
  OrderStatus,
  OrderStockStatus,
  PaymentMethodCode,
  PaymentStatus,
  ShipmentStatus,
} from '../../../common/enums';
import { InventoryService } from '../../branches/services/inventory.service';
import { CartService } from '../../cart/services/cart.service';
import { ProductsService } from '../../catalog/services/products.service';
import { AddressesService } from '../../customers/services/addresses.service';
import { LocationsService } from '../../locations/services/locations.service';
import { PaymentsService } from '../../payments/services/payments.service';
import { SubmitOrderReviewDto } from '../../reviews/dto/review.dto';
import { Review } from '../../reviews/entities/review.entity';
import { ReviewsService } from '../../reviews/services/reviews.service';
import { VouchersService } from '../../vouchers/services/vouchers.service';
import { AdminOrderQueryDto } from '../dto/admin-order-query.dto';
import { AdminOrderSummaryQueryDto } from '../dto/admin-order-summary-query.dto';
import {
  AdminCreateOrderDto,
  CheckoutDto,
  CheckoutItemDto,
  GuestCheckoutDto,
} from '../dto/checkout.dto';
import { Order, ShippingAddressSnapshot } from '../entities/order.entity';
import { OrdersRepository } from '../repositories/orders.repository';
import { ShipmentsRepository } from '../repositories/shipments.repository';

/** A resolved order line ready to persist (price/name pulled server-side). */
interface OrderLineItem {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantTitle: string;
  sku: string;
  unitPrice: string;
  quantity: number;
  imageUrl?: string;
}

/** Human variant label snapshot, e.g. "500g" or "Đen · M". Empty for
 *  single-variant products (no options) — nothing meaningful to show. */
function variantLabel(variant?: {
  optionValues?: { value: string; sortOrder: number }[];
}): string {
  return [...(variant?.optionValues ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((v) => v.value)
    .join(' · ');
}

/** Snapshot image for an order line: prefer the variant image, else the
 *  product's primary (or first) image. */
function lineImageUrl(variant?: {
  imageUrl?: string;
  product?: { images?: { url: string; isPrimary: boolean }[] };
}): string | undefined {
  if (variant?.imageUrl) return variant.imageUrl;
  const images = variant?.product?.images ?? [];
  const primary = images.find((i) => i.isPrimary) ?? images[0];
  return primary?.url;
}

/** Chuyển phạm vi chi nhánh → danh sách id để lọc query. `undefined` = không
 *  giới hạn (super admin / role mọi chi nhánh / route không RBAC). */
function allowedBranchIds(scope?: BranchScopeCtx): string[] | undefined {
  return scope && !scope.allBranches ? scope.branchIds : undefined;
}

/** Đánh giá ≤ ngưỡng này ⇒ cảnh báo BO (thông báo "Đánh giá thấp"). */
const LOW_RATING_THRESHOLD = 2;

@Injectable()
export class OrdersService {
  constructor(
    private readonly orders: OrdersRepository,
    private readonly dataSource: DataSource,
    private readonly cart: CartService,
    private readonly products: ProductsService,
    private readonly vouchers: VouchersService,
    private readonly payments: PaymentsService,
    private readonly addresses: AddressesService,
    private readonly inventory: InventoryService,
    private readonly locations: LocationsService,
    private readonly shipments: ShipmentsRepository,
    private readonly branches: BranchesService,
    private readonly adminNotifications: AdminNotificationsService,
    private readonly reviews: ReviewsService,
    private readonly notifications: NotificationsService,
  ) {}

  private readonly logger = new Logger(OrdersService.name);

  /** Bắn thông báo BO cho đơn storefront mới (fire-and-forget, không chặn/đánh
   *  hỏng việc tạo đơn nếu notification lỗi). */
  private async notifyNewOrder(order: Order): Promise<void> {
    try {
      const branch = await this.branches.findOne(order.branchId);
      await this.adminNotifications.notifyOrderCreated(order, branch.name);
    } catch (err) {
      this.logger.error(
        `Thông báo đơn mới ${order.code} thất bại: ${String(err)}`,
      );
    }
  }

  /** Logged-in checkout — items come from the customer's active server cart. */
  async checkout(customerId: string, dto: CheckoutDto): Promise<Order> {
    const cart = await this.cart.getActiveCart(customerId);
    if (!cart.items.length) throw new BadRequestException('Cart is empty');

    const lineItems: OrderLineItem[] = cart.items.map((i) => ({
      variantId: i.variantId,
      productId: i.variant?.productId ?? '',
      productSlug: i.variant?.product?.slug ?? '',
      productName: i.variant?.product?.name ?? i.variant?.sku ?? 'Item',
      variantTitle: variantLabel(i.variant),
      sku: i.variant?.sku ?? '',
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      imageUrl: lineImageUrl(i.variant),
    }));

    return this.placeOrder({
      customerId,
      dto,
      lineItems,
      currency: cart.currency,
      cartId: cart.id,
    });
  }

  /** Guest checkout — items come from the request body (no server cart). Prices
   *  and stock are still resolved/validated server-side. */
  async guestCheckout(dto: GuestCheckoutDto): Promise<Order> {
    const lineItems = await this.resolveLineItems(dto.items);
    return this.placeOrder({ dto, lineItems, currency: 'VND' });
  }

  /** Staff-entered order (phone order, walk-in, B2B deal closed offline…) — an
   *  authenticated admin action, not an anonymous storefront checkout. Kept as
   *  its own method (sharing the {@link resolveLineItems}/{@link placeOrder}
   *  core with guest checkout, not the method itself) so admin-only behaviour
   *  can diverge later without touching the public guest-checkout path. */
  async adminCreate(dto: AdminCreateOrderDto): Promise<Order> {
    const lineItems = await this.resolveLineItems(dto.items);
    return this.placeOrder({
      dto,
      lineItems,
      currency: 'VND',
      channel: OrderChannel.ADMIN,
    });
  }

  /** Resolve body-supplied (variantId, quantity) pairs into priced line items —
   *  the shared item-resolution step for both guest and staff-entered orders. */
  private async resolveLineItems(
    items: CheckoutItemDto[],
  ): Promise<OrderLineItem[]> {
    const lineItems: OrderLineItem[] = [];
    for (const it of items) {
      const variant = await this.products.getVariantOrFail(it.variantId);
      if (!variant.isActive) {
        throw new BadRequestException('Một sản phẩm không còn khả dụng');
      }
      lineItems.push({
        variantId: variant.id,
        productId: variant.productId,
        productSlug: variant.product?.slug ?? '',
        productName: variant.product?.name ?? variant.sku,
        variantTitle: variantLabel(variant),
        sku: variant.sku,
        unitPrice: variant.price,
        quantity: it.quantity,
        imageUrl: lineImageUrl(variant),
      });
    }
    return lineItems;
  }

  /** Shared order-creation core (prices recomputed here = source of truth). */
  private async placeOrder(params: {
    dto: CheckoutDto;
    lineItems: OrderLineItem[];
    currency: string;
    customerId?: string;
    cartId?: string;
    /** Who placed the order — defaults to the customer-facing storefront;
     *  {@link adminCreate} is the only caller that passes ADMIN. */
    channel?: OrderChannel;
  }): Promise<Order> {
    const {
      dto,
      lineItems,
      currency,
      customerId,
      cartId,
      channel = OrderChannel.STOREFRONT,
    } = params;

    // Friendly pre-check (the locked reserve below is the race-safe guard, but its
    // error is generic — this names the short items so the FE can tell the user).
    await this.assertAvailability(dto.branchId, lineItems);

    const shippingAddress =
      dto.fulfillment === FulfillmentType.DELIVERY
        ? await this.resolveShippingAddress(customerId, dto)
        : undefined;

    const subtotal = lineItems.reduce(
      (sum, i) => sum + Number(i.unitPrice) * i.quantity,
      0,
    );
    const shippingFee = Number(dto.shippingFee ?? 0);

    let discount = 0;
    let voucherId: string | undefined;
    if (dto.voucherCode) {
      const evaluation = await this.vouchers.evaluate(
        dto.voucherCode,
        subtotal,
        shippingFee,
        {
          branchId: dto.branchId,
          customerId,
          productSlugs: lineItems.map((i) => i.productSlug).filter(Boolean),
          shippingMethod: dto.shippingMethod,
        },
      );
      discount = evaluation.discount;
      voucherId = evaluation.voucher.id;
    }

    const grandTotal = subtotal - discount + shippingFee;

    const order = await this.dataSource.transaction(async (manager) => {
      for (const item of lineItems) {
        await this.inventory.reserve(
          manager,
          dto.branchId,
          item.variantId,
          item.quantity,
        );
      }

      const order = await this.orders.createInTx(manager, {
        code:
          dto.code?.trim() ||
          this.generateOrderCode(dto.fulfillment, dto.paymentMethodCode),
        customerId,
        branchId: dto.branchId,
        fulfillment: dto.fulfillment,
        shippingMethod: dto.shippingMethod,
        channel,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethodCode: dto.paymentMethodCode,
        recipientName: dto.recipientName,
        recipientPhone: dto.recipientPhone,
        recipientEmail: dto.recipientEmail,
        shippingAddress,
        subtotal: subtotal.toFixed(2),
        shippingFee: shippingFee.toFixed(2),
        discountTotal: discount.toFixed(2),
        grandTotal: grandTotal.toFixed(2),
        currency,
        voucherCode: dto.voucherCode,
        invoice: dto.invoice,
        notes: dto.notes,
        placedAt: new Date(),
        items: lineItems.map((i) => ({
          ...i,
          lineTotal: (Number(i.unitPrice) * i.quantity).toFixed(2),
        })) as any,
      });

      await this.payments.createForOrder(
        manager,
        order.id,
        dto.paymentMethodCode,
        grandTotal.toFixed(2),
      );

      if (voucherId) {
        await this.vouchers.redeem(manager, {
          voucherId,
          orderId: order.id,
          customerId,
          amount: discount.toFixed(2),
        });
      }

      if (cartId) await this.cart.markConverted(cartId);
      return order;
    });

    // Chỉ đơn khách tự đặt (storefront) mới sinh thông báo BO — đơn admin tạo
    // tay trên BO thì bỏ qua (người tạo đã biết). Fire-and-forget sau commit.
    if (channel === OrderChannel.STOREFRONT) void this.notifyNewOrder(order);

    return order;
  }

  async findMine(customerId: string, query: PaginationQueryDto) {
    const [data, total] = await this.orders.paginate(
      { customerId },
      query.skip,
      query.limit,
    );
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async findAll(query: AdminOrderQueryDto, scope?: BranchScopeCtx) {
    const [data, total] = await this.orders.searchAdmin(
      {
        branchId: query.branchId,
        status: query.status,
        paymentStatus: query.paymentStatus,
        shipmentStatus: query.shipmentStatus,
        q: query.q,
        // Giới hạn theo chi nhánh được phép (undefined = mọi chi nhánh).
        allowedBranchIds: allowedBranchIds(scope),
      },
      { by: query.sortBy ?? 'createdAt', order: query.sortOrder ?? 'DESC' },
      query.skip,
      query.limit,
    );
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  /** Dashboard aggregate — branch/date-range scoped, computed in SQL so it's
   *  correct for any order volume (not capped like the paginated list). */
  async summary(query: AdminOrderSummaryQueryDto, scope?: BranchScopeCtx) {
    const raw = await this.orders.summary({
      branchId: query.branchId,
      allowedBranchIds: allowedBranchIds(scope),
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    });

    const counts = new Map(
      raw.statusRows.map((r) => [r.status, Number(r.count)]),
    );
    const byStatus = Object.fromEntries(
      Object.values(OrderStatus).map((s) => [s, counts.get(s) ?? 0]),
    ) as Record<OrderStatus, number>;

    return {
      totalOrders: raw.totalOrders,
      totalRevenue: raw.totalRevenue,
      byStatus,
      series: raw.seriesRows.map((r) => ({ date: r.day, revenue: r.revenue })),
    };
  }

  async findOneForUser(customerId: string, id: string): Promise<Order> {
    const order = await this.findOne(id);
    if (order.customerId !== customerId) throw new ForbiddenException();
    return order;
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orders.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /** Storefront "review my order" (by order code): the customer must own the
   *  order and it must be DELIVERED; one review is created (PENDING) per product
   *  in the order, marked verified via the linked order. One-review-per-order is
   *  enforced in {@link ReviewsService.submitFromOrder}. */
  async createOrderReviews(
    customerId: string,
    code: string,
    dto: SubmitOrderReviewDto,
  ): Promise<Review[]> {
    const order = await this.orders.findByCode(code);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== customerId) throw new ForbiddenException();
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'Chỉ có thể đánh giá đơn hàng đã giao thành công.',
      );
    }

    // order_items only snapshot variant_id — resolve each to its product, then
    // dedupe (multiple variants of one product ⇒ a single review for it).
    // Mỗi order item (biến thể) → 1 review riêng (KHÔNG gộp theo product).
    // order_items chỉ snapshot variant_id/variant_title → phân giải productId +
    // tên sản phẩm cho từng dòng, giữ nguyên thứ tự/biến thể.
    // Build a map variantId → per-item review data from the DTO.
    const reviewByVariant = new Map(dto.items.map((i) => [i.variantId, i]));

    // Resolve productId for each order item; skip items the customer chose not
    // to rate (not present in the DTO).
    const allItems = await Promise.all(
      order.items.map(async (item) => {
        const variant = await this.products.getVariantOrFail(item.variantId);
        return {
          variantId: item.variantId,
          productId: variant.productId,
          variantTitle: item.variantTitle,
          productName: variant.product?.name ?? item.productName,
        };
      }),
    );

    // Only submit reviews for items the customer actually rated.
    const ratedItems = allItems
      .filter((l) => reviewByVariant.has(l.variantId))
      .map((l) => {
        const d = reviewByVariant.get(l.variantId)!;
        return {
          variantId: l.variantId,
          productId: l.productId,
          variantTitle: l.variantTitle,
          rating: d.rating,
          tags: d.tags,
          comment: d.comment,
          imageUrls: d.imageUrls,
        };
      });

    if (!ratedItems.length) {
      throw new BadRequestException('Không có sản phẩm nào được đánh giá.');
    }

    const reviews = await this.reviews.submitFromOrder({
      orderId: order.id,
      customerId,
      items: ratedItems,
    });

    // Notify BO for each low-rated item (≤2★) — fire-and-forget.
    const nameByVariant = new Map(allItems.map((l) => [l.variantId, l.productName]));
    for (const review of reviews) {
      if (review.rating <= LOW_RATING_THRESHOLD) {
        void this.adminNotifications
          .notifyLowRating({
            reviewId: review.id,
            productId: review.productId,
            productName: nameByVariant.get(review.variantId ?? '') ?? 'Sản phẩm',
            rating: review.rating,
            branchId: order.branchId,
          })
          .catch((err) =>
            this.logger.error(`Thông báo đánh giá thấp thất bại: ${String(err)}`),
          );
      }
    }

    return reviews;
  }

  /** Guest order tracking by code + phone. */
  async track(code: string, phone: string): Promise<Order> {
    const order = await this.orders.findByCode(code);
    if (!order || order.recipientPhone !== phone) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  /** Statuses that mean the goods have already left the building — cancelling from
   *  here needs a manual return process, not a stock-only rollback. */
  private static readonly SHIPPED_OR_BEYOND = new Set<OrderStatus>([
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
  ]);

  /** Payment methods captured upfront (must be confirmed PAID before staff start
   *  fulfilling) as opposed to COD, which is captured at the door. */
  private static readonly PREPAID_METHODS = new Set<PaymentMethodCode>([
    PaymentMethodCode.BANK_TRANSFER,
    PaymentMethodCode.MOMO,
    PaymentMethodCode.ATM_CARD,
  ]);

  /** Statuses that mean fulfilment has started. */
  private static readonly FULFILLMENT_STARTED = new Set<OrderStatus>([
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
  ]);

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.findOne(id);
    const previousStatus = order.status;

    if (
      status === OrderStatus.CANCELLED &&
      OrdersService.SHIPPED_OR_BEYOND.has(order.status)
    ) {
      throw new BadRequestException(
        'Đơn hàng đã giao/đang giao nên không thể hủy. Vui lòng xử lý hoàn trả thủ công.',
      );
    }
    if (
      OrdersService.FULFILLMENT_STARTED.has(status) &&
      order.paymentMethodCode &&
      OrdersService.PREPAID_METHODS.has(order.paymentMethodCode) &&
      order.paymentStatus !== PaymentStatus.PAID
    ) {
      throw new BadRequestException(
        'Đơn hàng chưa được xác nhận thanh toán, không thể chuyển sang xử lý/giao.',
      );
    }

    order.status = status;
    if (status === OrderStatus.CANCELLED) {
      return this.cancelStock(order); // release reserve / restock committed
    }
    if (status === OrderStatus.DELIVERED) {
      if (order.paymentMethodCode === PaymentMethodCode.COD) {
        order.paymentStatus = PaymentStatus.PAID; // COD captured on delivery
      }
      const delivered = await this.commitStock(order); // reserve → physical deduction
      // Count the sale exactly once — only on the first crossing into DELIVERED
      // (a re-issued DELIVERED transition must not double-bump sold_count).
      if (previousStatus !== OrderStatus.DELIVERED) {
        await this.products.recordSaleForOrder(order.id);
      }
      return delivered;
    }
    // Shipment creation via a carrier's real API (GHN/GHTK) is a separate,
    // explicit admin action once the order reaches PROCESSING — see
    // `GhnService`/`GhtkService` and their `POST .../shipment/ghn|ghtk`
    // endpoints. This used to auto-fire GHN here on every transition, but
    // that silently assumed every delivery order ships via GHN — now that
    // GHTK is also a real option, the admin must explicitly choose which
    // carrier to call after picking one, instead of the BE guessing for them.
    return this.orders.save(order);
  }

  async confirmPayment(id: string): Promise<Order> {
    const order = await this.findOne(id);
    const payment = await this.payments.findLatestForOrder(order.id);
    await this.payments.markStatus(payment.id, PaymentStatus.PAID);
    order.paymentStatus = PaymentStatus.PAID;
    if (order.status === OrderStatus.PENDING) {
      order.status = OrderStatus.CONFIRMED;
    }
    return this.commitStock(order); // prepaid captured → physical deduction
  }

  /** Cancel an order and return its stock (release if reserved, restock if
   *  committed). Normally not valid once the order has shipped (the guard in
   *  {@link updateStatus} requires a manual return) — but if the carrier has
   *  already reported the parcel RETURNED (a failed delivery, goods back at the
   *  branch), cancelling is safe here: the return concern is resolved, so we
   *  release/restock directly, bypassing that guard. Otherwise delegates to
   *  {@link updateStatus} unchanged. */
  /** Shipment outcomes that mean admin intervention is expected, so cancelling
   *  a shipped order is allowed (goods have returned, or the shipment hit a
   *  problem — carrier cancel / pickup-fail / lost / damaged). */
  private static readonly SHIPMENT_RESOLVABLE = new Set<ShipmentStatus>([
    ShipmentStatus.RETURNED,
    ShipmentStatus.PROBLEM,
    ShipmentStatus.PICKUP_FAILED,
  ]);

  async cancel(id: string): Promise<Order> {
    const order = await this.findOne(id);
    if (OrdersService.SHIPPED_OR_BEYOND.has(order.status)) {
      const shipment = await this.shipments.findByOrder(id);
      if (
        !shipment ||
        !OrdersService.SHIPMENT_RESOLVABLE.has(shipment.status)
      ) {
        throw new BadRequestException(
          'Đơn hàng đã giao/đang giao nên không thể hủy. Vui lòng xử lý hoàn trả thủ công.',
        );
      }
      order.status = OrderStatus.CANCELLED;
      return this.cancelStock(order); // hàng đã hoàn/sự cố → giải phóng/restock kho
    }
    return this.updateStatus(id, OrderStatus.CANCELLED);
  }

  /** Statuses a customer may still cancel from (before the order ships out). */
  private static readonly CANCELLABLE = new Set<OrderStatus>([
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
  ]);

  /** Customer-initiated cancel: must own the order and it must not have shipped. */
  async cancelForUser(customerId: string, id: string): Promise<Order> {
    const order = await this.findOneForUser(customerId, id);
    if (order.status === OrderStatus.CANCELLED) return order; // idempotent
    if (!OrdersService.CANCELLABLE.has(order.status)) {
      throw new BadRequestException(
        'Đơn hàng đang được xử lý/giao nên không thể hủy. Vui lòng liên hệ hỗ trợ.',
      );
    }
    order.status = OrderStatus.CANCELLED;
    return this.cancelStock(order);
  }

  /** Auto-cancel prepaid orders left unpaid past `minutes`, releasing their holds.
   *  COD is excluded (legitimately unpaid until delivery). Returns the count. */
  async autoCancelStaleOrders(minutes = 30): Promise<number> {
    const cutoff = new Date(Date.now() - minutes * 60_000);
    const stale = await this.orders.findStaleUnpaid(cutoff);
    for (const order of stale) {
      order.status = OrderStatus.CANCELLED;
      await this.cancelStock(order);
    }
    return stale.length;
  }

  /** Reserve → committed: physically deduct stock. Idempotent (guards on stockStatus). */
  private commitStock(order: Order): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      if (order.stockStatus === OrderStockStatus.RESERVED) {
        for (const item of order.items) {
          await this.inventory.commit(
            manager,
            order.branchId,
            item.variantId,
            item.quantity,
          );
        }
        order.stockStatus = OrderStockStatus.COMMITTED;
      }
      return manager.getRepository(Order).save(order);
    });
  }

  /** Return stock on cancel: release the hold (if still reserved) or restock
   *  (if already committed). Idempotent (no-op once released). Also reverses any
   *  voucher redemption tied to this order, freeing its usage slot back up.
   *
   *  When stock is physically returned (COMMITTED case), fires back-in-stock
   *  notifications after the transaction commits — fire-and-forget so a dispatch
   *  failure never rolls back or breaks the cancel. */
  private async cancelStock(order: Order): Promise<Order> {
    // Snapshot before the transaction mutates stockStatus.
    const wasCommitted = order.stockStatus === OrderStockStatus.COMMITTED;
    const branchId = order.branchId;
    const restockedItems = order.items.map((i) => ({
      variantId: i.variantId,
      productName: i.productName,
    }));

    const saved = await this.dataSource.transaction(async (manager) => {
      if (order.stockStatus === OrderStockStatus.RESERVED) {
        for (const item of order.items) {
          await this.inventory.release(
            manager,
            branchId,
            item.variantId,
            item.quantity,
          );
        }
        order.stockStatus = OrderStockStatus.RELEASED;
      } else if (order.stockStatus === OrderStockStatus.COMMITTED) {
        for (const item of order.items) {
          await this.inventory.restock(
            manager,
            branchId,
            item.variantId,
            item.quantity,
          );
        }
        order.stockStatus = OrderStockStatus.RELEASED;
      }
      await this.vouchers.unredeem(manager, order.id);
      return manager.getRepository(Order).save(order);
    });

    // Notify subscribers only after the transaction has committed (physical restock).
    if (wasCommitted) {
      for (const item of restockedItems) {
        this.notifications
          .dispatchBackInStock(item.variantId, branchId, {
            productName: item.productName,
          })
          .catch(() => undefined);
      }
    }

    return saved;
  }

  /** Pre-flight availability check with a per-item message (available = qty − reserved). */
  private async assertAvailability(
    branchId: string,
    lineItems: OrderLineItem[],
  ): Promise<void> {
    const short: string[] = [];
    for (const item of lineItems) {
      const record = await this.inventory.getRecord(branchId, item.variantId);
      if (record?.status === InventoryStatus.PREORDER) continue;
      const available = record
        ? Math.max(0, record.quantity - record.reserved)
        : 0;
      if (available < item.quantity) {
        short.push(`${item.productName} (còn ${available})`);
      }
    }
    if (short.length) {
      throw new BadRequestException(`Không đủ tồn kho: ${short.join('; ')}`);
    }
  }

  private async resolveShippingAddress(
    customerId: string | undefined,
    dto: CheckoutDto,
  ): Promise<ShippingAddressSnapshot> {
    if (customerId && dto.shippingAddressId) {
      const a = await this.addresses.findOne(customerId, dto.shippingAddressId);
      return {
        recipientName: a.recipientName,
        phone: a.phone,
        provinceCode: a.provinceCode,
        provinceName: a.provinceName,
        wardCode: a.wardCode,
        wardName: a.wardName,
        street: a.street,
      };
    }
    if (dto.shippingAddress) {
      // Resolve authoritative names from our own locations data.
      const { province, ward } = await this.locations.resolve(
        dto.shippingAddress.provinceCode,
        dto.shippingAddress.wardCode,
      );
      return {
        recipientName: dto.shippingAddress.recipientName,
        phone: dto.shippingAddress.phone,
        provinceCode: province.code,
        provinceName: province.name,
        wardCode: ward.code,
        wardName: ward.name,
        street: dto.shippingAddress.street,
      };
    }
    throw new BadRequestException(
      'Delivery requires shippingAddressId or shippingAddress',
    );
  }

  /** Fulfillment/payment prefixes so staff can tell an order's shape from its code alone. */
  private static readonly FULFILLMENT_CODE: Record<FulfillmentType, string> = {
    [FulfillmentType.DELIVERY]: 'GH',
    [FulfillmentType.PICKUP]: 'PU',
  };

  private static readonly PAYMENT_CODE: Record<PaymentMethodCode, string> = {
    [PaymentMethodCode.COD]: 'COD',
    [PaymentMethodCode.BANK_TRANSFER]: 'BANK',
    [PaymentMethodCode.MOMO]: 'MM',
    [PaymentMethodCode.ATM_CARD]: 'TT',
  };

  private generateOrderCode(
    fulfillment: FulfillmentType,
    paymentMethodCode: PaymentMethodCode,
  ): string {
    const suffix = Date.now().toString(36).toUpperCase().slice(-8);
    return `${OrdersService.FULFILLMENT_CODE[fulfillment]}-${OrdersService.PAYMENT_CODE[paymentMethodCode]}-${suffix}`;
  }
}
