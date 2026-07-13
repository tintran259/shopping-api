import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FulfillmentType, PaymentStatus } from '../../../common/enums';
import { GhnService } from './ghn.service';
import { GhnClient } from './ghn-client';
import { GhnAddressResolver } from './ghn-address-resolver';
import { ShipmentsRepository } from '../repositories/shipments.repository';
import { OrdersRepository } from '../repositories/orders.repository';
import { BranchesService } from '../../branches/services/branches.service';
import { ProductsService } from '../../catalog/services/products.service';
import { Order } from '../entities/order.entity';
import { Shipment } from '../entities/shipment.entity';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-id',
    code: 'ORD-1',
    branchId: 'branch-id',
    fulfillment: FulfillmentType.DELIVERY,
    paymentStatus: PaymentStatus.PENDING,
    grandTotal: '150000.00',
    recipientName: 'Nguyễn Văn A',
    recipientPhone: '0900000000',
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
      {
        variantId: 'variant-1',
        productName: 'Cà phê',
        sku: 'CF-001',
        unitPrice: '75000.00',
        quantity: 2,
      } as never,
    ],
    ...overrides,
  } as Order;
}

describe('GhnService', () => {
  let service: GhnService;
  let ghn: { createShippingOrder: jest.Mock };
  let addressResolver: { resolve: jest.Mock };
  let shipments: { findByOrder: jest.Mock; create: jest.Mock; save: jest.Mock };
  let orders: { findById: jest.Mock };
  let branches: { findOne: jest.Mock };
  let products: { getVariantOrFail: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    ghn = {
      createShippingOrder: jest
        .fn()
        .mockResolvedValue({ order_code: 'GHN123', total_fee: 20000 }),
    };
    addressResolver = {
      resolve: jest.fn().mockResolvedValue({ districtId: 11, wardCode: 'W1' }),
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
        ghnShopId: 'shop-1',
      }),
    };
    products = {
      getVariantOrFail: jest
        .fn()
        .mockResolvedValue({ id: 'variant-1', weightGram: 300 }),
    };
    config = { get: jest.fn().mockReturnValue('') };

    const module = await Test.createTestingModule({
      providers: [
        GhnService,
        { provide: GhnClient, useValue: ghn },
        { provide: GhnAddressResolver, useValue: addressResolver },
        { provide: ShipmentsRepository, useValue: shipments },
        { provide: OrdersRepository, useValue: orders },
        { provide: BranchesService, useValue: branches },
        { provide: ProductsService, useValue: products },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(GhnService);
  });

  it('throws for a pickup order', async () => {
    orders.findById.mockResolvedValue(
      makeOrder({ fulfillment: FulfillmentType.PICKUP }),
    );
    await expect(service.createShippingOrder('order-id')).rejects.toThrow(
      BadRequestException,
    );
    expect(ghn.createShippingOrder).not.toHaveBeenCalled();
  });

  it('throws when the order has no shipping address', async () => {
    orders.findById.mockResolvedValue(
      makeOrder({ shippingAddress: undefined }),
    );
    await expect(service.createShippingOrder('order-id')).rejects.toThrow(
      BadRequestException,
    );
    expect(ghn.createShippingOrder).not.toHaveBeenCalled();
  });

  it('is idempotent — returns the existing GHN shipment without calling GHN again', async () => {
    const existing = {
      id: 's1',
      orderId: 'order-id',
      carrier: 'GHN',
      trackingNo: 'GHN_ALREADY',
    } as Shipment;
    shipments.findByOrder.mockResolvedValue(existing);

    const result = await service.createShippingOrder('order-id');

    expect(result).toBe(existing);
    expect(ghn.createShippingOrder).not.toHaveBeenCalled();
  });

  it('throws when the branch (and no default) has no GHN shop id configured', async () => {
    branches.findOne.mockResolvedValue({
      id: 'branch-id',
      name: 'Chi nhánh 1',
      ghnShopId: undefined,
    });
    config.get.mockReturnValue(''); // no default shop id either

    await expect(service.createShippingOrder('order-id')).rejects.toThrow(
      BadRequestException,
    );
    expect(ghn.createShippingOrder).not.toHaveBeenCalled();
  });

  it('creates a shipment with the resolved address and GHN response', async () => {
    const result = await service.createShippingOrder('order-id');

    expect(addressResolver.resolve).toHaveBeenCalledWith(
      'Tỉnh Lâm Đồng',
      'Phường 1',
    );
    expect(ghn.createShippingOrder).toHaveBeenCalledWith(
      'shop-1',
      expect.objectContaining({
        to_ward_code: 'W1',
        to_district_id: 11,
        client_order_code: 'ORD-1',
        from_name: 'Chi nhánh 1',
        length: 20,
        width: 20,
        height: 20,
        insurance_value: 150000,
        items: [expect.objectContaining({ code: 'CF-001', price: 75000 })],
      }),
    );
    expect(result.carrier).toBe('GHN');
    expect(result.trackingNo).toBe('GHN123');
    expect(result.fee).toBe('20000');
  });

  it('passes an optional shipper note through to GHN', async () => {
    await service.createShippingOrder('order-id', {
      note: 'Gọi trước khi giao',
    });
    const payload = ghn.createShippingOrder.mock.calls[0][1];
    expect(payload.note).toBe('Gọi trước khi giao');
  });

  it('sums item weight from each variant, falling back to a default when unset', async () => {
    products.getVariantOrFail.mockResolvedValue({
      id: 'variant-1',
      weightGram: undefined,
    });
    orders.findById.mockResolvedValue(
      makeOrder({
        items: [
          {
            variantId: 'variant-1',
            productName: 'Cà phê',
            quantity: 3,
          } as never,
        ],
      }),
    );

    await service.createShippingOrder('order-id');

    const payload = ghn.createShippingOrder.mock.calls[0][1];
    expect(payload.weight).toBe(200 * 3); // DEFAULT_ITEM_WEIGHT_GRAM fallback
  });

  it('sends cod_amount = grandTotal for an unpaid order', async () => {
    orders.findById.mockResolvedValue(
      makeOrder({ paymentStatus: PaymentStatus.PENDING }),
    );
    await service.createShippingOrder('order-id');
    const payload = ghn.createShippingOrder.mock.calls[0][1];
    expect(payload.cod_amount).toBe(150000);
  });

  it('sends no cod_amount for an already-paid order', async () => {
    orders.findById.mockResolvedValue(
      makeOrder({ paymentStatus: PaymentStatus.PAID }),
    );
    await service.createShippingOrder('order-id');
    const payload = ghn.createShippingOrder.mock.calls[0][1];
    expect(payload.cod_amount).toBeUndefined();
  });

  it('falls back to the configured default shop id when the branch has none', async () => {
    branches.findOne.mockResolvedValue({
      id: 'branch-id',
      name: 'Chi nhánh 1',
      ghnShopId: undefined,
    });
    config.get.mockReturnValue('default-shop');

    await service.createShippingOrder('order-id');

    expect(ghn.createShippingOrder).toHaveBeenCalledWith(
      'default-shop',
      expect.anything(),
    );
  });
});
