import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaginatedResult } from '../../../common/dto/paginated-result';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  FulfillmentType,
  InventoryStatus,
  OrderStatus,
  OrderStockStatus,
  PaymentMethodCode,
  PaymentStatus,
} from '../../../common/enums';
import { InventoryService } from '../../branches/services/inventory.service';
import { CartService } from '../../cart/services/cart.service';
import { ProductsService } from '../../catalog/services/products.service';
import { AddressesService } from '../../customers/services/addresses.service';
import { LocationsService } from '../../locations/services/locations.service';
import { PaymentsService } from '../../payments/services/payments.service';
import { VouchersService } from '../../vouchers/services/vouchers.service';
import { AdminOrderQueryDto } from '../dto/admin-order-query.dto';
import { AdminOrderSummaryQueryDto } from '../dto/admin-order-summary-query.dto';
import { CheckoutDto, GuestCheckoutDto } from '../dto/checkout.dto';
import { Order, ShippingAddressSnapshot } from '../entities/order.entity';
import { OrdersRepository } from '../repositories/orders.repository';

/** A resolved order line ready to persist (price/name pulled server-side). */
interface OrderLineItem {
  variantId: string;
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
  ) {}

  /** Logged-in checkout — items come from the customer's active server cart. */
  async checkout(customerId: string, dto: CheckoutDto): Promise<Order> {
    const cart = await this.cart.getActiveCart(customerId);
    if (!cart.items.length) throw new BadRequestException('Cart is empty');

    const lineItems: OrderLineItem[] = cart.items.map((i) => ({
      variantId: i.variantId,
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
    const lineItems: OrderLineItem[] = [];
    for (const it of dto.items) {
      const variant = await this.products.getVariantOrFail(it.variantId);
      if (!variant.isActive) {
        throw new BadRequestException('Một sản phẩm không còn khả dụng');
      }
      lineItems.push({
        variantId: variant.id,
        productName: variant.product?.name ?? variant.sku,
        variantTitle: variantLabel(variant),
        sku: variant.sku,
        unitPrice: variant.price,
        quantity: it.quantity,
        imageUrl: lineImageUrl(variant),
      });
    }
    return this.placeOrder({ dto, lineItems, currency: 'VND' });
  }

  /** Shared order-creation core (prices recomputed here = source of truth). */
  private async placeOrder(params: {
    dto: CheckoutDto;
    lineItems: OrderLineItem[];
    currency: string;
    customerId?: string;
    cartId?: string;
  }): Promise<Order> {
    const { dto, lineItems, currency, customerId, cartId } = params;

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
      );
      discount = evaluation.discount;
      voucherId = evaluation.voucher.id;
    }

    const grandTotal = subtotal - discount + shippingFee;

    return this.dataSource.transaction(async (manager) => {
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
  }

  async findMine(customerId: string, query: PaginationQueryDto) {
    const [data, total] = await this.orders.paginate(
      { customerId },
      query.skip,
      query.limit,
    );
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async findAll(query: AdminOrderQueryDto) {
    const [data, total] = await this.orders.searchAdmin(
      {
        branchId: query.branchId,
        status: query.status,
        paymentStatus: query.paymentStatus,
        q: query.q,
      },
      { by: query.sortBy ?? 'createdAt', order: query.sortOrder ?? 'DESC' },
      query.skip,
      query.limit,
    );
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  /** Dashboard aggregate — branch/date-range scoped, computed in SQL so it's
   *  correct for any order volume (not capped like the paginated list). */
  async summary(query: AdminOrderSummaryQueryDto) {
    const raw = await this.orders.summary({
      branchId: query.branchId,
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
      return this.commitStock(order); // reserve → physical deduction
    }
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

  /** Cancel an order and return its stock (release if reserved, restock if committed).
   *  Not valid once the order has shipped — the guard lives in {@link updateStatus},
   *  which this simply delegates to. */
  cancel(id: string): Promise<Order> {
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
   *  (if already committed). Idempotent (no-op once released). */
  private cancelStock(order: Order): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      if (order.stockStatus === OrderStockStatus.RESERVED) {
        for (const item of order.items) {
          await this.inventory.release(
            manager,
            order.branchId,
            item.variantId,
            item.quantity,
          );
        }
        order.stockStatus = OrderStockStatus.RELEASED;
      } else if (order.stockStatus === OrderStockStatus.COMMITTED) {
        for (const item of order.items) {
          await this.inventory.restock(
            manager,
            order.branchId,
            item.variantId,
            item.quantity,
          );
        }
        order.stockStatus = OrderStockStatus.RELEASED;
      }
      return manager.getRepository(Order).save(order);
    });
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
