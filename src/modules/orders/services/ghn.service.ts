import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FulfillmentType, PaymentStatus } from '../../../common/enums';
import { BranchesService } from '../../branches/services/branches.service';
import { ProductsService } from '../../catalog/services/products.service';
import { CreateGhnShipmentDto } from '../dto/create-ghn-shipment.dto';
import { Shipment } from '../entities/shipment.entity';
import { OrdersRepository } from '../repositories/orders.repository';
import { ShipmentsRepository } from '../repositories/shipments.repository';
import { GhnAddressResolver } from './ghn-address-resolver';
import { GhnClient } from './ghn-client';

/** No weight on file for a variant (not yet filled in by the admin) — a
 *  placeholder so an order can still ship rather than blocking on it. */
const DEFAULT_ITEM_WEIGHT_GRAM = 200;

/** GHN requires one of a fixed set of "required note" values; this is the
 *  least restrictive option (view but not try) and a reasonable default for
 *  a specialty-food store — revisit if a different default fits better. */
const DEFAULT_REQUIRED_NOTE = 'CHOXEMHANGKHONGTHU';

/** GHN's standard delivery service. */
const DEFAULT_SERVICE_TYPE_ID = 2;

/** GHN requires package dimensions alongside weight — we have no per-product
 *  dimension data anywhere in this system, so a fixed small-parcel default is
 *  used (same fallback spirit as the item-weight default). Revisit if a
 *  future product form ever captures real box dimensions. */
const DEFAULT_PACKAGE_LENGTH_CM = 20;
const DEFAULT_PACKAGE_WIDTH_CM = 20;
const DEFAULT_PACKAGE_HEIGHT_CM = 20;

/**
 * Creates a real GHN shipping order for a delivery order and records it as
 * that order's `Shipment` — an explicit admin action (`POST
 * /admin/orders/:id/shipment/ghn`), not something fired automatically on a
 * status transition (that used to silently assume every delivery order
 * ships via GHN, which broke down once GHTK became a second real option —
 * see `OrdersService.updateStatus`). Since this is now a foreground action
 * the admin just clicked, it throws real errors instead of swallowing them,
 * so the FE can show exactly why it failed.
 */
@Injectable()
export class GhnService {
  constructor(
    private readonly ghn: GhnClient,
    private readonly addressResolver: GhnAddressResolver,
    private readonly shipments: ShipmentsRepository,
    private readonly orders: OrdersRepository,
    private readonly branches: BranchesService,
    private readonly products: ProductsService,
    private readonly config: ConfigService,
  ) {}

  async createShippingOrder(
    orderId: string,
    dto: CreateGhnShipmentDto = {},
  ): Promise<Shipment> {
    const order = await this.orders.findById(orderId);
    if (!order) throw new BadRequestException('Order not found');
    if (order.fulfillment !== FulfillmentType.DELIVERY) {
      throw new BadRequestException(
        'Đơn nhận tại cửa hàng không cần vận chuyển',
      );
    }
    if (!order.shippingAddress) {
      throw new BadRequestException('Đơn hàng chưa có địa chỉ giao hàng');
    }

    const existing = await this.shipments.findByOrder(order.id);
    if (existing?.trackingNo && existing.carrier === 'GHN') return existing; // idempotent no-op

    const branch = await this.branches.findOne(order.branchId);
    const shopId =
      branch.ghnShopId || this.config.get<string>('ghn.defaultShopId');
    if (!shopId) {
      throw new BadRequestException(
        `Chi nhánh "${branch.name}" chưa cấu hình GHN Shop ID`,
      );
    }

    const { districtId, wardCode } = await this.addressResolver.resolve(
      order.shippingAddress.provinceName,
      order.shippingAddress.wardName,
    );

    const items = await Promise.all(
      order.items.map(async (item) => {
        const variant = await this.products.getVariantOrFail(item.variantId);
        return {
          name: item.productName,
          code: item.sku,
          price: Number(item.unitPrice),
          quantity: item.quantity,
          weight: variant.weightGram ?? DEFAULT_ITEM_WEIGHT_GRAM,
        };
      }),
    );
    const totalWeight = items.reduce(
      (sum, i) => sum + i.weight * i.quantity,
      0,
    );

    const codAmount =
      order.paymentStatus === PaymentStatus.PAID ? 0 : Number(order.grandTotal);

    const response = await this.ghn.createShippingOrder(shopId, {
      from_name: branch.name,
      from_phone: branch.phone,
      from_address: branch.address,
      to_name: order.recipientName,
      to_phone: order.recipientPhone,
      to_address: order.shippingAddress.street,
      to_ward_code: wardCode,
      to_district_id: districtId,
      weight: totalWeight,
      length: DEFAULT_PACKAGE_LENGTH_CM,
      width: DEFAULT_PACKAGE_WIDTH_CM,
      height: DEFAULT_PACKAGE_HEIGHT_CM,
      service_type_id: DEFAULT_SERVICE_TYPE_ID,
      payment_type_id: 1, // shop trả phí ship — điều chỉnh nếu chính sách khác
      required_note: DEFAULT_REQUIRED_NOTE,
      cod_amount: codAmount || undefined,
      insurance_value: Number(order.grandTotal),
      content: `Đơn hàng ${order.code}`,
      note: dto.note,
      items,
      client_order_code: order.code,
    });

    const shipment =
      existing ?? this.shipments.create({ orderId: order.id, carrier: 'GHN' });
    shipment.carrier = 'GHN';
    shipment.trackingNo = response.order_code;
    shipment.fee = String(response.total_fee);
    return this.shipments.save(shipment);
  }
}
