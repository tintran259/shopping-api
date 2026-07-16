import { BadRequestException, Injectable } from '@nestjs/common';
import {
  FulfillmentType,
  PaymentStatus,
  ShipmentStatus,
} from '../../../common/enums';
import { Branch } from '../../branches/entities/branch.entity';
import { BranchesService } from '../../branches/services/branches.service';
import { ProductsService } from '../../catalog/services/products.service';
import { LocationsService } from '../../locations/services/locations.service';
import { CreateGhtkShipmentDto } from '../dto/create-ghtk-shipment.dto';
import { Order } from '../entities/order.entity';
import { Shipment } from '../entities/shipment.entity';
import { OrdersRepository } from '../repositories/orders.repository';
import { ShipmentsRepository } from '../repositories/shipments.repository';
import { GhtkClient } from './ghtk-client';

/** No weight on file for a variant (not yet filled in by the admin) — same
 *  fallback as `GhnService`, so an order can still ship rather than blocking
 *  on it. */
const DEFAULT_ITEM_WEIGHT_GRAM = 200;
const GRAMS_PER_KG = 1000;

/**
 * Creates a real GHTK shipping order for a delivery order — unlike
 * `GhnService`, this is an explicit admin action (`POST
 * /admin/orders/:id/shipment/ghtk`), not something fired automatically on a
 * status transition, so it throws real errors instead of swallowing them:
 * the admin just clicked "Tạo vận đơn" and expects to see whether it worked.
 */
@Injectable()
export class GhtkService {
  constructor(
    private readonly ghtk: GhtkClient,
    private readonly shipments: ShipmentsRepository,
    private readonly orders: OrdersRepository,
    private readonly branches: BranchesService,
    private readonly products: ProductsService,
    private readonly locations: LocationsService,
  ) {}

  async createShippingOrder(
    orderId: string,
    dto: CreateGhtkShipmentDto,
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

    // A failed shipment (returned / problem / pickup-failed) is eligible for
    // redeliver — bypass the idempotency guard so a fresh GHTK order can be
    // created. Active or delivered shipments are still skipped as before.
    const isFailedShipment =
      existing?.status === ShipmentStatus.RETURNED ||
      existing?.status === ShipmentStatus.PROBLEM ||
      existing?.status === ShipmentStatus.PICKUP_FAILED;

    if (
      existing?.trackingNo &&
      existing.carrier === 'GHTK' &&
      !isFailedShipment
    ) {
      return existing; // idempotent for active / delivered shipments
    }

    const branch = await this.branches.findOne(order.branchId);
    if (!branch.ghtkPickupDistrict || !branch.ghtkPickupWard) {
      throw new BadRequestException(
        `Chi nhánh "${branch.name}" chưa cấu hình quận/huyện và phường/xã lấy hàng cho GHTK`,
      );
    }
    const pickProvince = await this.resolveProvinceName(branch.provinceCode);

    const items = await Promise.all(
      order.items.map(async (item) => {
        const variant = await this.products.getVariantOrFail(item.variantId);
        return {
          name: item.productName,
          weight:
            (variant.weightGram ?? DEFAULT_ITEM_WEIGHT_GRAM) / GRAMS_PER_KG,
          quantity: item.quantity,
        };
      }),
    );

    const pickMoney =
      order.paymentStatus === PaymentStatus.PAID ? 0 : Number(order.grandTotal);

    const response = await this.ghtk.createOrder({
      order: {
        id: order.code,
        pick_name: branch.name,
        pick_address: branch.address ?? '',
        pick_province: pickProvince,
        pick_district: branch.ghtkPickupDistrict,
        pick_ward: branch.ghtkPickupWard,
        pick_tel: branch.phone ?? '',
        name: order.shippingAddress.recipientName,
        address: order.shippingAddress.street,
        province: order.shippingAddress.provinceName,
        district: dto.district,
        ward: order.shippingAddress.wardName,
        tel: order.shippingAddress.phone,
        pick_money: pickMoney || undefined,
        value: dto.value ?? Number(order.grandTotal),
        is_freeship: dto.isFreeship ? 1 : 0,
        weight_option: 'kilogram',
        note: dto.note,
      },
      products: items,
    });

    const shipment =
      existing ?? this.shipments.create({ orderId: order.id, carrier: 'GHTK' });
    shipment.carrier = 'GHTK';
    shipment.trackingNo = response.order!.label;
    shipment.fee = response.order!.fee;

    // Redeliver: reset all timeline timestamps and carrier status so the new
    // shipment's timeline starts fresh — old delivery attempt data must not
    // bleed into the new one's timeline display.
    if (isFailedShipment) {
      Object.assign(shipment, {
        status: ShipmentStatus.PENDING,
        shippedAt: null,
        inTransitAt: null,
        deliveredAt: null,
        returnedAt: null,
        problemAt: null,
        carrierStatusRaw: null,
      });
    }

    return this.shipments.save(shipment);
  }

  /** Returns printable HTML for the GHTK shipping label of this order.
   *  Real mode: proxies GHTK's label API (token required).
   *  Mock mode (no token): generates a mock label with order data so the
   *  print flow can be exercised locally without a real GHTK account. */
  async getLabelHtml(orderId: string): Promise<string> {
    const shipment = await this.shipments.findByOrder(orderId);
    if (!shipment?.trackingNo || shipment.carrier !== 'GHTK') {
      throw new BadRequestException('Đơn hàng chưa có vận đơn GHTK');
    }

    if (!this.ghtk.isMockMode) {
      return this.ghtk.getLabelHtml(shipment.trackingNo);
    }

    const order = await this.orders.findById(orderId);
    if (!order) throw new BadRequestException('Không tìm thấy đơn hàng');
    const branch = order.branchId
      ? await this.branches.findOne(order.branchId).catch(() => null)
      : null;
    return this.buildMockLabelHtml(shipment, order, branch);
  }

  private buildMockLabelHtml(
    shipment: Shipment,
    order: Order,
    branch: Branch | null,
  ): string {
    const addr = order.shippingAddress;
    const isCod = order.paymentStatus !== PaymentStatus.PAID;
    const recipientName = addr?.recipientName ?? order.recipientName;
    const recipientPhone = addr?.phone ?? order.recipientPhone;
    const recipientAddress = [addr?.street, addr?.wardName, addr?.provinceName]
      .filter(Boolean)
      .join(', ');
    const codAmount = Number(order.grandTotal).toLocaleString('vi-VN');
    const itemList = order.items
      .map((it) => `<li>${it.productName} × ${it.quantity}</li>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Phiếu vận chuyển GHTK – ${shipment.trackingNo}</title>
  <style>
    @page { size: A5; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; background: #fff; }
    .label { border: 2px solid #000; }

    /* Header */
    .header { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 2px solid #000; }
    .carrier-name { font-size: 22px; font-weight: 900; color: #009b40; letter-spacing: -1px; }
    .mock-badge { background: #d00; color: #fff; font-size: 9px; font-weight: bold; padding: 2px 5px; border-radius: 2px; text-transform: uppercase; }

    /* Barcode zone */
    .barcode-zone { text-align: center; padding: 10px; border-bottom: 1px dashed #555; }
    .barcode-bars { font-family: 'Libre Barcode 128', 'Courier New', monospace; font-size: 48px; line-height: 1; letter-spacing: -1px; margin-bottom: 4px; overflow: hidden; }
    .tracking-no { font-size: 13px; font-weight: bold; letter-spacing: 3px; }

    /* Address grid */
    .address-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #000; }
    .address-cell { padding: 8px 10px; }
    .address-cell + .address-cell { border-left: 1px solid #000; }
    .cell-label { font-size: 9px; text-transform: uppercase; font-weight: bold; color: #555; margin-bottom: 3px; }
    .cell-name { font-size: 13px; font-weight: bold; margin-bottom: 2px; }
    .cell-detail { font-size: 10px; line-height: 1.5; color: #222; }

    /* Recipient full row */
    .recipient-row { padding: 8px 10px; border-bottom: 1px solid #000; }

    /* Items */
    .items-row { padding: 6px 10px; border-bottom: 1px solid #000; }
    .items-row ul { list-style: none; padding-left: 0; }
    .items-row li { font-size: 10px; line-height: 1.6; }

    /* COD bar */
    .cod-bar { padding: 8px 10px; text-align: center; font-size: 15px; font-weight: bold; background: #000; color: #fff; }
    .no-cod { padding: 8px 10px; text-align: center; font-size: 12px; background: #f0f0f0; color: #444; }

    /* Footer */
    .footer { padding: 5px 10px; font-size: 8px; color: #888; text-align: center; }

    @media print { @page { margin: 8mm; } }
  </style>
</head>
<body>
<div class="label">
  <div class="header">
    <span class="carrier-name">GHTK</span>
    <span>
      <span class="mock-badge">MOCK</span>
      &nbsp;<strong style="font-size:12px;">Phiếu giao hàng</strong>
    </span>
  </div>

  <div class="barcode-zone">
    <div class="barcode-bars">|||||||||||||||||||||||||||||||||||||||||||||||</div>
    <div class="tracking-no">${shipment.trackingNo}</div>
  </div>

  <div class="address-grid">
    <div class="address-cell">
      <div class="cell-label">Người gửi</div>
      <div class="cell-name">${branch?.name ?? 'Shop'}</div>
      <div class="cell-detail">${branch?.phone ?? ''}</div>
      <div class="cell-detail">${branch?.address ?? ''}</div>
      ${branch?.ghtkPickupDistrict ? `<div class="cell-detail">${branch.ghtkPickupDistrict}</div>` : ''}
    </div>
    <div class="address-cell">
      <div class="cell-label">Mã đơn</div>
      <div class="cell-name">${order.code}</div>
    </div>
  </div>

  <div class="recipient-row">
    <div class="cell-label">Người nhận</div>
    <div class="cell-name">${recipientName}</div>
    <div class="cell-detail">${recipientPhone}</div>
    <div class="cell-detail">${recipientAddress}</div>
  </div>

  <div class="items-row">
    <div class="cell-label">Sản phẩm</div>
    <ul>${itemList}</ul>
  </div>

  ${
    isCod
      ? `<div class="cod-bar">Thu hộ (COD): ${codAmount}₫</div>`
      : `<div class="no-cod">Đã thanh toán – Không thu hộ</div>`
  }

  <div class="footer">
    Phiếu mock – dùng để kiểm tra luồng in ấn khi chưa có token GHTK thật.
  </div>
</div>
<script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
  }

  private async resolveProvinceName(provinceCode?: string): Promise<string> {
    if (!provinceCode) {
      throw new BadRequestException(
        'Chi nhánh chưa cấu hình tỉnh/thành lấy hàng',
      );
    }
    const provinces = await this.locations.listProvinces();
    const province = provinces.find((p) => p.code === Number(provinceCode));
    if (!province) {
      throw new BadRequestException('Mã tỉnh/thành của chi nhánh không hợp lệ');
    }
    return province.name;
  }
}
