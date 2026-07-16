import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ShipmentStatus } from '../../../common/enums';
import { CARRIER_STATUS_MAPS } from '../carrier-status-maps';
import { UpsertShipmentDto } from '../dto/upsert-shipment.dto';
import { Shipment } from '../entities/shipment.entity';
import { OrdersRepository } from '../repositories/orders.repository';
import { ShipmentsRepository } from '../repositories/shipments.repository';

/** Shipment tracking (carrier/tracking no/fee/status) is supplementary info
 *  attached to an order — independent of `Order.status` (pending → … →
 *  delivered), which stays the source of truth for the reserve→commit stock
 *  flow. Admins can fill this in whenever, in any order. */
@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);

  constructor(
    private readonly shipments: ShipmentsRepository,
    private readonly orders: OrdersRepository,
  ) {}

  async findByOrder(orderId: string): Promise<Shipment | null> {
    await this.assertOrderExists(orderId);
    return this.shipments.findByOrder(orderId);
  }

  /** Resets a failed shipment (RETURNED / PROBLEM / PICKUP_FAILED) so the
   *  admin can pick a carrier and create a fresh shipment from scratch.
   *  Clears carrier, trackingNo, all timestamps, and reverts status to PENDING
   *  so the UI's `isEditingCarrier` logic returns to the initial picker state. */
  async resetForRedeliver(orderId: string): Promise<Shipment> {
    await this.assertOrderExists(orderId);
    const shipment = await this.shipments.findByOrder(orderId);
    if (!shipment)
      throw new BadRequestException('Đơn hàng chưa có thông tin vận chuyển');

    const FAILED = new Set([
      ShipmentStatus.RETURNED,
      ShipmentStatus.PROBLEM,
      ShipmentStatus.PICKUP_FAILED,
    ]);
    if (!FAILED.has(shipment.status)) {
      throw new BadRequestException(
        'Chỉ có thể giao lại khi vận đơn đang ở trạng thái hoàn hàng, sự cố hoặc lấy thất bại.',
      );
    }

    Object.assign(shipment, {
      carrier: null,
      trackingNo: null,
      fee: '0',
      status: ShipmentStatus.PENDING,
      carrierStatusRaw: null,
      shippedAt: null,
      inTransitAt: null,
      deliveredAt: null,
      returnedAt: null,
      problemAt: null,
    });
    return this.shipments.save(shipment);
  }

  async upsert(orderId: string, dto: UpsertShipmentDto): Promise<Shipment> {
    await this.assertOrderExists(orderId);
    let shipment = await this.shipments.findByOrder(orderId);
    if (!shipment) {
      shipment = this.shipments.create({ orderId, ...dto });
    } else {
      Object.assign(shipment, dto);
    }

    this.stampTransitionTimestamps(shipment, dto.status);
    return this.shipments.save(shipment);
  }

  /** Called by each carrier's webhook controller (`GhnWebhookController`,
   *  `GhtkWebhookController`) — every carrier identifies the shipment by the
   *  tracking code it assigned at creation time (our `Shipment.trackingNo`),
   *  but each has its own status vocabulary, so the caller passes its own
   *  `statusMap` (see `carrier-status-maps.ts`) rather than this service
   *  hardcoding one carrier's mapping. Never throws (a webhook has no one to
   *  report a validation error to but the carrier itself, which would just
   *  retry) — returns whether a matching shipment was found, purely for the
   *  controller's own logging. */
  async handleCarrierUpdate(
    trackingNo: string,
    rawStatus: string,
    statusMap: Record<string, ShipmentStatus>,
  ): Promise<boolean> {
    const shipment = await this.shipments.findByTrackingNo(trackingNo);
    if (!shipment) {
      this.logger.warn(
        `Carrier webhook for unknown tracking no "${trackingNo}"`,
      );
      return false;
    }

    shipment.carrierStatusRaw = rawStatus;
    const mapped = statusMap[rawStatus];
    if (mapped) {
      this.stampTransitionTimestamps(shipment, mapped);
      shipment.status = mapped;
    }

    await this.shipments.save(shipment);
    return true;
  }

  /** Testing helper — simulates the carrier's own webhook calling us, for
   *  when there's no real account/public callback URL to actually receive
   *  one (e.g. exercising the GHN/GHTK mock-mode flow locally). Reuses
   *  {@link handleCarrierUpdate} so the simulated update goes through the
   *  exact same logic a real webhook call would. */
  async simulateCarrierWebhook(
    orderId: string,
    carrierStatus: string,
  ): Promise<Shipment> {
    await this.assertOrderExists(orderId);
    const shipment = await this.shipments.findByOrder(orderId);
    if (!shipment?.trackingNo) {
      throw new BadRequestException(
        'Đơn chưa có vận đơn (mã vận đơn) để giả lập webhook',
      );
    }
    const statusMap = shipment.carrier && CARRIER_STATUS_MAPS[shipment.carrier];
    if (!statusMap) {
      throw new BadRequestException(
        `Đơn vị vận chuyển "${shipment.carrier}" không hỗ trợ giả lập webhook`,
      );
    }

    await this.handleCarrierUpdate(
      shipment.trackingNo,
      carrierStatus,
      statusMap,
    );
    return (await this.shipments.findByOrder(orderId))!;
  }

  /** First time a shipment enters SHIPPED/IN_TRANSIT/DELIVERED/RETURNED/PROBLEM,
   *  stamp the timestamp — don't overwrite it on a later, unrelated update. */
  private stampTransitionTimestamps(
    shipment: Shipment,
    status: ShipmentStatus | undefined,
  ): void {
    if (status === ShipmentStatus.SHIPPED && !shipment.shippedAt) {
      shipment.shippedAt = new Date();
    }
    if (status === ShipmentStatus.IN_TRANSIT && !shipment.inTransitAt) {
      shipment.inTransitAt = new Date();
    }
    if (status === ShipmentStatus.DELIVERED && !shipment.deliveredAt) {
      shipment.deliveredAt = new Date();
    }
    if (status === ShipmentStatus.RETURNED && !shipment.returnedAt) {
      shipment.returnedAt = new Date();
    }
    if (
      (status === ShipmentStatus.PROBLEM ||
        status === ShipmentStatus.PICKUP_FAILED) &&
      !shipment.problemAt
    ) {
      shipment.problemAt = new Date();
    }
  }

  private async assertOrderExists(orderId: string): Promise<void> {
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
  }
}
