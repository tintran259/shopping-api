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
  OrderStatus,
  PaymentStatus,
} from '../../../common/enums';
import { InventoryService } from '../../branches/services/inventory.service';
import { CartService } from '../../cart/services/cart.service';
import { AddressesService } from '../../customers/services/addresses.service';
import { LocationsService } from '../../locations/services/locations.service';
import { PaymentsService } from '../../payments/services/payments.service';
import { VouchersService } from '../../vouchers/services/vouchers.service';
import { CheckoutDto } from '../dto/checkout.dto';
import { Order, ShippingAddressSnapshot } from '../entities/order.entity';
import { OrdersRepository } from '../repositories/orders.repository';

@Injectable()
export class OrdersService {
  constructor(
    private readonly orders: OrdersRepository,
    private readonly dataSource: DataSource,
    private readonly cart: CartService,
    private readonly vouchers: VouchersService,
    private readonly payments: PaymentsService,
    private readonly addresses: AddressesService,
    private readonly inventory: InventoryService,
    private readonly locations: LocationsService,
  ) {}

  async checkout(customerId: string, dto: CheckoutDto): Promise<Order> {
    const cart = await this.cart.getActiveCart(customerId);
    if (!cart.items.length) throw new BadRequestException('Cart is empty');

    const shippingAddress =
      dto.fulfillment === FulfillmentType.DELIVERY
        ? await this.resolveShippingAddress(customerId, dto)
        : undefined;

    const subtotal = cart.items.reduce(
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
      for (const item of cart.items) {
        await this.inventory.reserve(
          manager,
          dto.branchId,
          item.variantId,
          item.quantity,
        );
      }

      const order = await this.orders.createInTx(manager, {
        code: this.generateOrderCode(),
        customerId,
        branchId: dto.branchId,
        fulfillment: dto.fulfillment,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        recipientName: dto.recipientName,
        recipientPhone: dto.recipientPhone,
        recipientEmail: dto.recipientEmail,
        shippingAddress,
        subtotal: subtotal.toFixed(2),
        shippingFee: shippingFee.toFixed(2),
        discountTotal: discount.toFixed(2),
        grandTotal: grandTotal.toFixed(2),
        currency: cart.currency,
        voucherCode: dto.voucherCode,
        invoice: dto.invoice,
        notes: dto.notes,
        placedAt: new Date(),
        items: cart.items.map((i) => ({
          variantId: i.variantId,
          productName: i.variant?.product?.name ?? i.variant?.sku ?? 'Item',
          variantTitle: i.variant?.sku ?? '',
          sku: i.variant?.sku ?? '',
          unitPrice: i.unitPrice,
          quantity: i.quantity,
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

      await this.cart.markConverted(cart.id);
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

  async findAll(query: PaginationQueryDto) {
    const [data, total] = await this.orders.paginate(
      {},
      query.skip,
      query.limit,
    );
    return new PaginatedResult(data, total, query.page, query.limit);
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

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.findOne(id);
    order.status = status;
    if (status === OrderStatus.DELIVERED) {
      order.paymentStatus = PaymentStatus.PAID; // COD captured on delivery
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
    return this.orders.save(order);
  }

  private async resolveShippingAddress(
    customerId: string,
    dto: CheckoutDto,
  ): Promise<ShippingAddressSnapshot> {
    if (dto.shippingAddressId) {
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

  private generateOrderCode(): string {
    return 'DH' + Date.now().toString(36).toUpperCase().slice(-8);
  }
}
