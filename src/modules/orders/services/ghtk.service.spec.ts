import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FulfillmentType, PaymentStatus } from '../../../common/enums';
import { GhtkService } from './ghtk.service';
import { GhtkClient } from './ghtk-client';
import { ShipmentsRepository } from '../repositories/shipments.repository';
import { OrdersRepository } from '../repositories/orders.repository';
import { BranchesService } from '../../branches/services/branches.service';
import { ProductsService } from '../../catalog/services/products.service';
import { LocationsService } from '../../locations/services/locations.service';
import { Order } from '../entities/order.entity';
import { Shipment } from '../entities/shipment.entity';
import { CreateGhtkShipmentDto } from '../dto/create-ghtk-shipment.dto';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-id',
    code: 'ORD-1',
    branchId: 'branch-id',
    fulfillment: FulfillmentType.DELIVERY,
    paymentStatus: PaymentStatus.PENDING,
    grandTotal: '150000.00',
    shippingAddress: {
      recipientName: 'Nguyễn Văn A',
      phone: '0900000000',
      provinceCode: 1,
      provinceName: 'Tỉnh Lâm Đồng',
      wardCode: 2,
      wardName: 'Phường 1',
      street: '123 Đường ABC',
    },
    items: [
      { variantId: 'variant-1', productName: 'Cà phê', quantity: 2 } as never,
    ],
    ...overrides,
  } as Order;
}

const dto: CreateGhtkShipmentDto = { district: 'Quận 1' };

describe('GhtkService', () => {
  let service: GhtkService;
  let ghtk: { createOrder: jest.Mock };
  let shipments: { findByOrder: jest.Mock; create: jest.Mock; save: jest.Mock };
  let orders: { findById: jest.Mock };
  let branches: { findOne: jest.Mock };
  let products: { getVariantOrFail: jest.Mock };
  let locations: { listProvinces: jest.Mock };

  beforeEach(async () => {
    ghtk = {
      createOrder: jest.fn().mockResolvedValue({
        success: true,
        order: { label: 'GHTK123', fee: '20000', tracking_id: 1, status_id: 1 },
      }),
    };
    shipments = {
      findByOrder: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ ...data }) as Shipment),
      save: jest.fn(async (s) => s),
    };
    orders = { findById: jest.fn().mockResolvedValue(makeOrder()) };
    branches = {
      findOne: jest.fn().mockResolvedValue({
        id: 'branch-id',
        name: 'Chi nhánh 1',
        address: '1 Đường XYZ',
        phone: '0911111111',
        provinceCode: '1',
        ghtkPickupDistrict: 'Quận Bảo Lộc',
        ghtkPickupWard: 'Phường 1',
      }),
    };
    products = {
      getVariantOrFail: jest
        .fn()
        .mockResolvedValue({ id: 'variant-1', weightGram: 300 }),
    };
    locations = {
      listProvinces: jest
        .fn()
        .mockResolvedValue([{ code: 1, name: 'Tỉnh Lâm Đồng' }]),
    };

    const module = await Test.createTestingModule({
      providers: [
        GhtkService,
        { provide: GhtkClient, useValue: ghtk },
        { provide: ShipmentsRepository, useValue: shipments },
        { provide: OrdersRepository, useValue: orders },
        { provide: BranchesService, useValue: branches },
        { provide: ProductsService, useValue: products },
        { provide: LocationsService, useValue: locations },
      ],
    }).compile();

    service = module.get(GhtkService);
  });

  it('throws for a pickup order', async () => {
    orders.findById.mockResolvedValue(
      makeOrder({ fulfillment: FulfillmentType.PICKUP }),
    );
    await expect(service.createShippingOrder('order-id', dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(ghtk.createOrder).not.toHaveBeenCalled();
  });

  it('throws when the branch has no GHTK pickup district/ward configured', async () => {
    branches.findOne.mockResolvedValue({
      id: 'branch-id',
      name: 'Chi nhánh 1',
      ghtkPickupDistrict: undefined,
      ghtkPickupWard: undefined,
    });
    await expect(service.createShippingOrder('order-id', dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(ghtk.createOrder).not.toHaveBeenCalled();
  });

  it('is idempotent — returns the existing GHTK shipment without calling GHTK again', async () => {
    const existing = {
      id: 's1',
      orderId: 'order-id',
      carrier: 'GHTK',
      trackingNo: 'GHTK_ALREADY',
    } as Shipment;
    shipments.findByOrder.mockResolvedValue(existing);

    const result = await service.createShippingOrder('order-id', dto);

    expect(result).toBe(existing);
    expect(ghtk.createOrder).not.toHaveBeenCalled();
  });

  it('creates a shipment using the branch pickup config, order address, and admin-entered district', async () => {
    const result = await service.createShippingOrder('order-id', dto);

    expect(ghtk.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({
          pick_province: 'Tỉnh Lâm Đồng',
          pick_district: 'Quận Bảo Lộc',
          pick_ward: 'Phường 1',
          province: 'Tỉnh Lâm Đồng',
          ward: 'Phường 1',
          district: 'Quận 1',
        }),
      }),
    );
    expect(result.carrier).toBe('GHTK');
    expect(result.trackingNo).toBe('GHTK123');
    expect(result.fee).toBe('20000');
  });

  it('converts variant weight from grams to kilograms, falling back to a default', async () => {
    products.getVariantOrFail.mockResolvedValue({
      id: 'variant-1',
      weightGram: undefined,
    });

    await service.createShippingOrder('order-id', dto);

    const payload = ghtk.createOrder.mock.calls[0][0];
    expect(payload.products[0].weight).toBe(0.2); // 200g default
  });

  it('sends pick_money = grandTotal for an unpaid (COD) order', async () => {
    orders.findById.mockResolvedValue(
      makeOrder({ paymentStatus: PaymentStatus.PENDING }),
    );
    await service.createShippingOrder('order-id', dto);
    const payload = ghtk.createOrder.mock.calls[0][0];
    expect(payload.order.pick_money).toBe(150000);
  });

  it('sends no pick_money for an already-paid order', async () => {
    orders.findById.mockResolvedValue(
      makeOrder({ paymentStatus: PaymentStatus.PAID }),
    );
    await service.createShippingOrder('order-id', dto);
    const payload = ghtk.createOrder.mock.calls[0][0];
    expect(payload.order.pick_money).toBeUndefined();
  });
});
