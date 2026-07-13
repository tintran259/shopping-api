import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ShipmentStatus } from '../../../common/enums';
import { GHN_STATUS_MAP, GHTK_STATUS_MAP } from '../carrier-status-maps';
import { ShipmentsService } from './shipments.service';
import { OrdersRepository } from '../repositories/orders.repository';
import { ShipmentsRepository } from '../repositories/shipments.repository';
import { Shipment } from '../entities/shipment.entity';
import { Order } from '../entities/order.entity';
import { UpsertShipmentDto } from '../dto/upsert-shipment.dto';

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: 'shipment-id',
    orderId: 'order-id',
    status: ShipmentStatus.PENDING,
    fee: '0.00',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Shipment;
}

describe('ShipmentsService', () => {
  let service: ShipmentsService;
  let shipments: { [K in keyof ShipmentsRepository]: jest.Mock };
  let orders: { findById: jest.Mock };

  beforeEach(async () => {
    shipments = {
      findByOrder: jest.fn(),
      findByTrackingNo: jest.fn(),
      create: jest.fn((data: Partial<Shipment>) => data as Shipment),
      save: jest.fn(async (s: Shipment) => s),
    };
    orders = { findById: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        { provide: ShipmentsRepository, useValue: shipments },
        { provide: OrdersRepository, useValue: orders },
      ],
    }).compile();

    service = module.get(ShipmentsService);
  });

  describe('findByOrder', () => {
    it('throws 404 when the order does not exist', async () => {
      orders.findById.mockResolvedValue(null);
      await expect(service.findByOrder('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns null when the order exists but has no shipment yet', async () => {
      orders.findById.mockResolvedValue({ id: 'order-id' } as Order);
      shipments.findByOrder.mockResolvedValue(null);
      await expect(service.findByOrder('order-id')).resolves.toBeNull();
    });
  });

  describe('upsert', () => {
    it('throws 404 when the order does not exist', async () => {
      orders.findById.mockResolvedValue(null);
      await expect(
        service.upsert('missing', { carrier: 'GHN' } as UpsertShipmentDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a new shipment when none exists yet', async () => {
      orders.findById.mockResolvedValue({ id: 'order-id' } as Order);
      shipments.findByOrder.mockResolvedValue(null);

      const result = await service.upsert('order-id', {
        carrier: 'GHN',
        trackingNo: 'ABC123',
      } as UpsertShipmentDto);

      expect(shipments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-id',
          carrier: 'GHN',
          trackingNo: 'ABC123',
        }),
      );
      expect(result.carrier).toBe('GHN');
    });

    it('updates fields on an existing shipment rather than creating a second one', async () => {
      const existing = makeShipment({ carrier: 'GHN', fee: '20000.00' });
      orders.findById.mockResolvedValue({ id: 'order-id' } as Order);
      shipments.findByOrder.mockResolvedValue(existing);

      const result = await service.upsert('order-id', {
        fee: '25000.00',
      } as UpsertShipmentDto);

      expect(shipments.create).not.toHaveBeenCalled();
      expect(result.carrier).toBe('GHN'); // untouched
      expect(result.fee).toBe('25000.00');
    });

    it('stamps shippedAt the first time status becomes SHIPPED', async () => {
      const existing = makeShipment({
        status: ShipmentStatus.PENDING,
        shippedAt: undefined,
      });
      orders.findById.mockResolvedValue({ id: 'order-id' } as Order);
      shipments.findByOrder.mockResolvedValue(existing);

      const result = await service.upsert('order-id', {
        status: ShipmentStatus.SHIPPED,
      } as UpsertShipmentDto);

      expect(result.shippedAt).toBeInstanceOf(Date);
    });

    it('does not overwrite shippedAt on a later, unrelated update', async () => {
      const firstShippedAt = new Date('2026-01-01T00:00:00Z');
      const existing = makeShipment({
        status: ShipmentStatus.SHIPPED,
        shippedAt: firstShippedAt,
      });
      orders.findById.mockResolvedValue({ id: 'order-id' } as Order);
      shipments.findByOrder.mockResolvedValue(existing);

      const result = await service.upsert('order-id', {
        status: ShipmentStatus.SHIPPED,
        fee: '30000.00',
      } as UpsertShipmentDto);

      expect(result.shippedAt).toBe(firstShippedAt);
      expect(result.fee).toBe('30000.00');
    });

    it('stamps deliveredAt the first time status becomes DELIVERED', async () => {
      const existing = makeShipment({
        status: ShipmentStatus.SHIPPED,
        deliveredAt: undefined,
      });
      orders.findById.mockResolvedValue({ id: 'order-id' } as Order);
      shipments.findByOrder.mockResolvedValue(existing);

      const result = await service.upsert('order-id', {
        status: ShipmentStatus.DELIVERED,
      } as UpsertShipmentDto);

      expect(result.deliveredAt).toBeInstanceOf(Date);
    });
  });

  describe('handleCarrierUpdate (carrier webhooks)', () => {
    it('returns false and does nothing for an unknown tracking number', async () => {
      shipments.findByTrackingNo.mockResolvedValue(null);

      const found = await service.handleCarrierUpdate(
        'UNKNOWN',
        'delivering',
        GHN_STATUS_MAP,
      );

      expect(found).toBe(false);
      expect(shipments.save).not.toHaveBeenCalled();
    });

    it('maps a recognized GHN status onto our coarse ShipmentStatus', async () => {
      const existing = makeShipment({
        trackingNo: 'GHN123',
        status: ShipmentStatus.PENDING,
      });
      shipments.findByTrackingNo.mockResolvedValue(existing);

      const found = await service.handleCarrierUpdate(
        'GHN123',
        'picking',
        GHN_STATUS_MAP,
      );

      expect(found).toBe(true);
      expect(existing.status).toBe(ShipmentStatus.SHIPPED);
      expect(existing.carrierStatusRaw).toBe('picking');
    });

    it('stamps deliveredAt the first time GHN reports "delivered"', async () => {
      const existing = makeShipment({
        trackingNo: 'GHN123',
        status: ShipmentStatus.SHIPPED,
      });
      shipments.findByTrackingNo.mockResolvedValue(existing);

      await service.handleCarrierUpdate('GHN123', 'delivered', GHN_STATUS_MAP);

      expect(existing.status).toBe(ShipmentStatus.DELIVERED);
      expect(existing.deliveredAt).toBeInstanceOf(Date);
    });

    it('maps a failed delivery (GHN delivery_fail) to RETURNED and stamps returnedAt', async () => {
      const existing = makeShipment({
        trackingNo: 'GHN123',
        status: ShipmentStatus.SHIPPED,
      });
      shipments.findByTrackingNo.mockResolvedValue(existing);

      await service.handleCarrierUpdate(
        'GHN123',
        'delivery_fail',
        GHN_STATUS_MAP,
      );

      expect(existing.status).toBe(ShipmentStatus.RETURNED);
      expect(existing.returnedAt).toBeInstanceOf(Date);
      expect(existing.carrierStatusRaw).toBe('delivery_fail');
    });

    it('maps GHTK "9" (undeliverable) to RETURNED', async () => {
      const existing = makeShipment({
        trackingNo: 'GHTK9',
        status: ShipmentStatus.SHIPPED,
      });
      shipments.findByTrackingNo.mockResolvedValue(existing);

      await service.handleCarrierUpdate('GHTK9', '9', GHTK_STATUS_MAP);

      expect(existing.status).toBe(ShipmentStatus.RETURNED);
      expect(existing.returnedAt).toBeInstanceOf(Date);
    });

    it('maps post-handover problems (GHN lost, GHTK -1) to PROBLEM and stamps problemAt', async () => {
      const ghn = makeShipment({ trackingNo: 'GHN123', status: ShipmentStatus.SHIPPED });
      shipments.findByTrackingNo.mockResolvedValue(ghn);
      await service.handleCarrierUpdate('GHN123', 'lost', GHN_STATUS_MAP);
      expect(ghn.status).toBe(ShipmentStatus.PROBLEM);
      expect(ghn.problemAt).toBeInstanceOf(Date);

      const ghtk = makeShipment({ trackingNo: 'GHTK-1', status: ShipmentStatus.PENDING });
      shipments.findByTrackingNo.mockResolvedValue(ghtk);
      await service.handleCarrierUpdate('GHTK-1', '-1', GHTK_STATUS_MAP);
      expect(ghtk.status).toBe(ShipmentStatus.PROBLEM);
    });

    it('maps a pre-handover pickup failure (GHTK "7") to PICKUP_FAILED, not PROBLEM', async () => {
      const ghtk = makeShipment({ trackingNo: 'GHTK7', status: ShipmentStatus.PENDING });
      shipments.findByTrackingNo.mockResolvedValue(ghtk);
      await service.handleCarrierUpdate('GHTK7', '7', GHTK_STATUS_MAP);
      expect(ghtk.status).toBe(ShipmentStatus.PICKUP_FAILED);
      expect(ghtk.problemAt).toBeInstanceOf(Date);
    });

    it('records a genuinely unmapped raw status without changing our coarse status', async () => {
      const existing = makeShipment({
        trackingNo: 'GHN123',
        status: ShipmentStatus.SHIPPED,
      });
      shipments.findByTrackingNo.mockResolvedValue(existing);

      await service.handleCarrierUpdate('GHN123', 'unknown_code', GHN_STATUS_MAP);

      expect(existing.status).toBe(ShipmentStatus.SHIPPED); // unchanged
      expect(existing.carrierStatusRaw).toBe('unknown_code'); // still recorded
    });

    it('maps a recognized GHTK status_id onto our coarse ShipmentStatus', async () => {
      const existing = makeShipment({
        trackingNo: 'S1.A1.123',
        status: ShipmentStatus.PENDING,
      });
      shipments.findByTrackingNo.mockResolvedValue(existing);

      const found = await service.handleCarrierUpdate(
        'S1.A1.123',
        '3',
        GHTK_STATUS_MAP,
      );

      expect(found).toBe(true);
      expect(existing.status).toBe(ShipmentStatus.SHIPPED);
      expect(existing.carrierStatusRaw).toBe('3');
    });

    it('maps in-transit carrier statuses (GHTK "4", GHN transporting) to IN_TRANSIT and stamps inTransitAt', async () => {
      const ghtk = makeShipment({
        trackingNo: 'S1.A1.123',
        status: ShipmentStatus.SHIPPED,
      });
      shipments.findByTrackingNo.mockResolvedValue(ghtk);
      await service.handleCarrierUpdate('S1.A1.123', '4', GHTK_STATUS_MAP);
      expect(ghtk.status).toBe(ShipmentStatus.IN_TRANSIT);
      expect(ghtk.inTransitAt).toBeInstanceOf(Date);

      const ghn = makeShipment({
        trackingNo: 'GHN123',
        status: ShipmentStatus.SHIPPED,
      });
      shipments.findByTrackingNo.mockResolvedValue(ghn);
      await service.handleCarrierUpdate('GHN123', 'transporting', GHN_STATUS_MAP);
      expect(ghn.status).toBe(ShipmentStatus.IN_TRANSIT);
      expect(ghn.inTransitAt).toBeInstanceOf(Date);
    });
  });

  describe('simulateCarrierWebhook', () => {
    it('throws when the order has no shipment/tracking number yet', async () => {
      orders.findById.mockResolvedValue({ id: 'order-id' } as Order);
      shipments.findByOrder.mockResolvedValue(null);

      await expect(
        service.simulateCarrierWebhook('order-id', 'delivering'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when the shipment carrier has no known status map (e.g. a manual courier)', async () => {
      orders.findById.mockResolvedValue({ id: 'order-id' } as Order);
      shipments.findByOrder.mockResolvedValue(
        makeShipment({ carrier: 'Viettel Post', trackingNo: 'VTP1' }),
      );

      await expect(
        service.simulateCarrierWebhook('order-id', 'x'),
      ).rejects.toThrow(BadRequestException);
    });

    it('simulates a GHN webhook update end-to-end, reusing handleCarrierUpdate', async () => {
      const existing = makeShipment({
        carrier: 'GHN',
        trackingNo: 'MOCK-GHN-1',
        status: ShipmentStatus.PENDING,
      });
      orders.findById.mockResolvedValue({ id: 'order-id' } as Order);
      shipments.findByOrder.mockResolvedValue(existing);
      shipments.findByTrackingNo.mockResolvedValue(existing);

      const result = await service.simulateCarrierWebhook(
        'order-id',
        'delivering',
      );

      expect(result.status).toBe(ShipmentStatus.IN_TRANSIT);
      expect(result.carrierStatusRaw).toBe('delivering');
    });
  });
});
