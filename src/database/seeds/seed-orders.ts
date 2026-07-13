/**
 * Order test-case seeder — wipes all orders then re-creates 12 scenarios
 * covering the full status matrix (order × payment × shipment).
 *
 * Run:  npx ts-node -r tsconfig-paths/register src/database/seeds/seed-orders.ts
 */
import { DataSource } from 'typeorm';
import {
  FulfillmentType,
  OrderChannel,
  OrderStatus,
  OrderStockStatus,
  PaymentMethodCode,
  PaymentStatus,
  ShipmentStatus,
} from '../../common/enums';
import { Order } from '../../modules/orders/entities/order.entity';
import { OrderItem } from '../../modules/orders/entities/order-item.entity';
import { Shipment } from '../../modules/orders/entities/shipment.entity';
import { AppDataSource } from '../data-source';

// ── Hardcoded IDs derived from `npm run seed` output ─────────────────
// Run `docker exec shopping-api-db psql -U shopping -d shopping_api -c "SELECT id,name FROM branches;"` to verify.
const BRANCH_Q1 = 'a3f42e91-3bf0-4289-bd70-cc2bfd877740'; // Chi nhánh Quận 1 (HCM)
const BRANCH_HK = 'ee846f84-ee93-4c55-a05a-5cfbdf7b65db'; // Chi nhánh Hoàn Kiếm (HN)

// Variants with stock in each branch (from seed data).
const V = {
  dauTay500g: {
    id: '83f441f4-6de9-45c6-ad75-3781e274b734',
    sku: 'dau-tay-say-deo-500g',
    name: 'Dâu tây sấy dẻo',
    title: '500g',
    price: '180000.00',
    img: 'https://down-vn.img.susercontent.com/file/vn-11134207-81ztc-mn13pkt3l4as2c',
  },
  khoai250g: {
    id: '44b3f6aa-c19d-4c22-8ca8-b63d44297047',
    sku: 'khoai-lang-say-deo-250g',
    name: 'Khoai lang sấy dẻo',
    title: '250g',
    price: '65000.00',
    img: 'https://down-vn.img.susercontent.com/file/vn-11134207-81ztc-mn8d3mybh5ag17',
  },
  hong500g: {
    id: '77f79594-60d4-45a7-aee3-c9a73945d3de',
    sku: 'hong-treo-gio-500g',
    name: 'Hồng treo gió',
    title: '500g',
    price: '220000.00',
    img: 'https://down-vn.img.susercontent.com/file/vn-11134207-81ztc-mn6zrd0zzpqe34',
  },
  caphe250g: {
    id: '3586e095-803f-408b-9dc7-c42a2bd14c34',
    sku: 'ca-phe-cau-dat-250g',
    name: 'Cà phê Cầu Đất (Arabica)',
    title: '250g',
    price: '110000.00',
    img: 'https://down-vn.img.susercontent.com/file/vn-11134207-81ztc-mn2p5ygzvev4d7',
  },
  macca250g: {
    id: '4dd18306-46b9-4575-9879-47697c5c4d82',
    sku: 'hat-mac-ca-250g',
    name: 'Hạt mắc ca',
    title: '250g',
    price: '120000.00',
    img: 'https://down-vn.img.susercontent.com/file/vn-11134207-81ztc-mn6of31w7hfo84',
  },
};

const ADDR_HCM = {
  recipientName: '',
  phone: '',
  provinceCode: 79,
  provinceName: 'Thành phố Hồ Chí Minh',
  wardCode: 25760,
  wardName: 'Phường Bình Dương',
  street: '123 Đường Nguyễn Huệ',
};
const ADDR_HN = {
  recipientName: '',
  phone: '',
  provinceCode: 1,
  provinceName: 'Thành phố Hà Nội',
  wardCode: 91,
  wardName: 'Phường Phú Thượng',
  street: '78 Hàng Bài',
};

// ── Helpers ───────────────────────────────────────────────────────────
function calcTotals(items: Array<{ price: string; qty: number }>, fee = 30_000) {
  const subtotal = items.reduce((s, i) => s + parseFloat(i.price) * i.qty, 0);
  return {
    subtotal: subtotal.toFixed(2),
    shippingFee: fee.toFixed(2),
    discountTotal: '0.00',
    grandTotal: (subtotal + fee).toFixed(2),
  };
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

interface TC {
  code: string;
  label: string; // notes field — shown in BO for context
  branchId: string;
  fulfillment: FulfillmentType;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  stockStatus: OrderStockStatus;
  paymentMethodCode: PaymentMethodCode;
  channel: OrderChannel;
  recipientName: string;
  recipientPhone: string;
  address?: typeof ADDR_HCM;
  items: Array<{ variant: (typeof V)[keyof typeof V]; qty: number }>;
  shipment?: Partial<Shipment>;
  placedDaysAgo: number;
}

const TEST_CASES: TC[] = [
  // ── 1. Chờ xác nhận ─────────────────────────────────────────────────
  {
    code: 'TC-01-PENDING',
    label: '[TC-01] Đơn mới — chờ xác nhận, COD, giao hàng',
    branchId: BRANCH_Q1,
    fulfillment: FulfillmentType.DELIVERY,
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.PENDING,
    stockStatus: OrderStockStatus.RESERVED,
    paymentMethodCode: PaymentMethodCode.COD,
    channel: OrderChannel.STOREFRONT,
    recipientName: 'Nguyễn Văn An',
    recipientPhone: '0901000001',
    address: ADDR_HCM,
    items: [{ variant: V.dauTay500g, qty: 2 }],
    placedDaysAgo: 0,
  },
  // ── 2. Đã xác nhận, chưa TT (prepaid) ───────────────────────────────
  {
    code: 'TC-02-CONFIRMED-UNPAID',
    label: '[TC-02] Đã xác nhận — chuyển khoản, chờ xác nhận thanh toán',
    branchId: BRANCH_Q1,
    fulfillment: FulfillmentType.DELIVERY,
    status: OrderStatus.CONFIRMED,
    paymentStatus: PaymentStatus.PENDING,
    stockStatus: OrderStockStatus.RESERVED,
    paymentMethodCode: PaymentMethodCode.BANK_TRANSFER,
    channel: OrderChannel.STOREFRONT,
    recipientName: 'Trần Thị Bích',
    recipientPhone: '0902000002',
    address: ADDR_HCM,
    items: [
      { variant: V.khoai250g, qty: 3 },
      { variant: V.hong500g, qty: 1 },
    ],
    placedDaysAgo: 1,
  },
  // ── 3. Đang xử lý, chưa tạo vận đơn ────────────────────────────────
  {
    code: 'TC-03-PROCESSING-NO-SHIP',
    label: '[TC-03] Đang xử lý — COD, chưa tạo vận đơn',
    branchId: BRANCH_Q1,
    fulfillment: FulfillmentType.DELIVERY,
    status: OrderStatus.PROCESSING,
    paymentStatus: PaymentStatus.PENDING,
    stockStatus: OrderStockStatus.RESERVED,
    paymentMethodCode: PaymentMethodCode.COD,
    channel: OrderChannel.STOREFRONT,
    recipientName: 'Lê Văn Cường',
    recipientPhone: '0903000003',
    address: ADDR_HCM,
    items: [{ variant: V.hong500g, qty: 1 }],
    placedDaysAgo: 2,
  },
  // ── 4. Đang xử lý, đã tạo vận đơn GHTK (chờ lấy hàng) ─────────────
  {
    code: 'TC-04-PROCESSING-GHTK-PENDING',
    label: '[TC-04] Đang xử lý — đã tạo vận đơn GHTK, chờ lấy hàng',
    branchId: BRANCH_Q1,
    fulfillment: FulfillmentType.DELIVERY,
    status: OrderStatus.PROCESSING,
    paymentStatus: PaymentStatus.PENDING,
    stockStatus: OrderStockStatus.RESERVED,
    paymentMethodCode: PaymentMethodCode.COD,
    channel: OrderChannel.STOREFRONT,
    recipientName: 'Phạm Thị Dung',
    recipientPhone: '0904000004',
    address: ADDR_HCM,
    items: [
      { variant: V.khoai250g, qty: 2 },
      { variant: V.dauTay500g, qty: 1 },
    ],
    shipment: {
      carrier: 'GHTK',
      trackingNo: 'MOCK-GHTK-TC04',
      status: ShipmentStatus.PENDING,
      fee: '30000.00',
    },
    placedDaysAgo: 2,
  },
  // ── 5. Đang giao, vận chuyển in-transit ─────────────────────────────
  {
    code: 'TC-05-SHIPPED-IN-TRANSIT',
    label: '[TC-05] Đang giao — GHTK đang vận chuyển',
    branchId: BRANCH_Q1,
    fulfillment: FulfillmentType.DELIVERY,
    status: OrderStatus.SHIPPED,
    paymentStatus: PaymentStatus.PENDING,
    stockStatus: OrderStockStatus.RESERVED,
    paymentMethodCode: PaymentMethodCode.COD,
    channel: OrderChannel.STOREFRONT,
    recipientName: 'Hoàng Văn Em',
    recipientPhone: '0905000005',
    address: ADDR_HCM,
    items: [{ variant: V.hong500g, qty: 2 }],
    shipment: {
      carrier: 'GHTK',
      trackingNo: 'MOCK-GHTK-TC05',
      status: ShipmentStatus.IN_TRANSIT,
      fee: '30000.00',
      shippedAt: daysAgo(1),
      inTransitAt: daysAgo(1),
    },
    placedDaysAgo: 3,
  },
  // ── 6. Đã giao thành công ────────────────────────────────────────────
  {
    code: 'TC-06-DELIVERED',
    label: '[TC-06] Đã giao — hoàn tất, COD thu hộ',
    branchId: BRANCH_Q1,
    fulfillment: FulfillmentType.DELIVERY,
    status: OrderStatus.DELIVERED,
    paymentStatus: PaymentStatus.PAID,
    stockStatus: OrderStockStatus.COMMITTED,
    paymentMethodCode: PaymentMethodCode.COD,
    channel: OrderChannel.STOREFRONT,
    recipientName: 'Vũ Thị Hoa',
    recipientPhone: '0906000006',
    address: ADDR_HCM,
    items: [
      { variant: V.dauTay500g, qty: 1 },
      { variant: V.khoai250g, qty: 2 },
    ],
    shipment: {
      carrier: 'GHTK',
      trackingNo: 'MOCK-GHTK-TC06',
      status: ShipmentStatus.DELIVERED,
      fee: '30000.00',
      shippedAt: daysAgo(4),
      inTransitAt: daysAgo(4),
      deliveredAt: daysAgo(2),
    },
    placedDaysAgo: 6,
  },
  // ── 7. Giao thất bại — hoàn hàng ────────────────────────────────────
  {
    code: 'TC-07-RETURNED',
    label: '[TC-07] Giao thất bại — hàng đang hoàn về (RETURNED)',
    branchId: BRANCH_Q1,
    fulfillment: FulfillmentType.DELIVERY,
    status: OrderStatus.SHIPPED,
    paymentStatus: PaymentStatus.PENDING,
    stockStatus: OrderStockStatus.RESERVED,
    paymentMethodCode: PaymentMethodCode.COD,
    channel: OrderChannel.STOREFRONT,
    recipientName: 'Đặng Văn Giang',
    recipientPhone: '0907000007',
    address: ADDR_HCM,
    items: [{ variant: V.hong500g, qty: 1 }],
    shipment: {
      carrier: 'GHTK',
      trackingNo: 'MOCK-GHTK-TC07',
      status: ShipmentStatus.RETURNED,
      fee: '30000.00',
      shippedAt: daysAgo(5),
      inTransitAt: daysAgo(5),
      returnedAt: daysAgo(1),
      carrierStatusRaw: 'Giao hàng không thành công - Chuyển hoàn',
    },
    placedDaysAgo: 7,
  },
  // ── 8. Sự cố vận chuyển (mất / hư / hoàn thất bại) ──────────────────
  {
    code: 'TC-08-PROBLEM',
    label: '[TC-08] Sự cố vận chuyển — hàng đang ở phía carrier (PROBLEM)',
    branchId: BRANCH_HK,
    fulfillment: FulfillmentType.DELIVERY,
    status: OrderStatus.SHIPPED,
    paymentStatus: PaymentStatus.PENDING,
    stockStatus: OrderStockStatus.RESERVED,
    paymentMethodCode: PaymentMethodCode.COD,
    channel: OrderChannel.STOREFRONT,
    recipientName: 'Bùi Thị Hiền',
    recipientPhone: '0908000008',
    address: ADDR_HN,
    items: [
      { variant: V.caphe250g, qty: 2 },
      { variant: V.macca250g, qty: 1 },
    ],
    shipment: {
      carrier: 'GHTK',
      trackingNo: 'MOCK-GHTK-TC08',
      status: ShipmentStatus.PROBLEM,
      fee: '30000.00',
      shippedAt: daysAgo(6),
      inTransitAt: daysAgo(6),
      problemAt: daysAgo(2),
      carrierStatusRaw: 'Phát sinh sự cố - Hàng hư hỏng trong quá trình vận chuyển',
    },
    placedDaysAgo: 8,
  },
  // ── 9. Không lấy được hàng (hàng chưa rời kho) ──────────────────────
  {
    code: 'TC-09-PICKUP-FAILED',
    label: '[TC-09] Không lấy được hàng — carrier không đến lấy (PICKUP_FAILED)',
    branchId: BRANCH_Q1,
    fulfillment: FulfillmentType.DELIVERY,
    status: OrderStatus.PROCESSING,
    paymentStatus: PaymentStatus.PENDING,
    stockStatus: OrderStockStatus.RESERVED,
    paymentMethodCode: PaymentMethodCode.COD,
    channel: OrderChannel.STOREFRONT,
    recipientName: 'Ngô Văn Khánh',
    recipientPhone: '0909000009',
    address: ADDR_HCM,
    items: [{ variant: V.dauTay500g, qty: 3 }],
    shipment: {
      carrier: 'GHTK',
      trackingNo: 'MOCK-GHTK-TC09',
      status: ShipmentStatus.PICKUP_FAILED,
      fee: '30000.00',
      problemAt: daysAgo(1),
      carrierStatusRaw: 'Lấy hàng thất bại - Shipper không liên lạc được',
    },
    placedDaysAgo: 3,
  },
  // ── 10. Đã hủy ──────────────────────────────────────────────────────
  {
    code: 'TC-10-CANCELLED',
    label: '[TC-10] Đã hủy — trước khi giao, tồn kho đã hoàn',
    branchId: BRANCH_Q1,
    fulfillment: FulfillmentType.DELIVERY,
    status: OrderStatus.CANCELLED,
    paymentStatus: PaymentStatus.PENDING,
    stockStatus: OrderStockStatus.RELEASED,
    paymentMethodCode: PaymentMethodCode.COD,
    channel: OrderChannel.STOREFRONT,
    recipientName: 'Đinh Thị Lan',
    recipientPhone: '0910000010',
    address: ADDR_HCM,
    items: [{ variant: V.khoai250g, qty: 1 }],
    placedDaysAgo: 5,
  },
  // ── 11. Nhận tại cửa hàng — đã giao ────────────────────────────────
  {
    code: 'TC-11-PICKUP-DELIVERED',
    label: '[TC-11] Nhận tại cửa hàng — hoàn tất, đã thanh toán',
    branchId: BRANCH_Q1,
    fulfillment: FulfillmentType.PICKUP,
    status: OrderStatus.DELIVERED,
    paymentStatus: PaymentStatus.PAID,
    stockStatus: OrderStockStatus.COMMITTED,
    paymentMethodCode: PaymentMethodCode.COD,
    channel: OrderChannel.STOREFRONT,
    recipientName: 'Mai Văn Minh',
    recipientPhone: '0911000011',
    items: [
      { variant: V.hong500g, qty: 1 },
      { variant: V.khoai250g, qty: 2 },
    ],
    placedDaysAgo: 3,
  },
  // ── 12. Nhận tại cửa hàng — đang xử lý ─────────────────────────────
  {
    code: 'TC-12-PICKUP-PROCESSING',
    label: '[TC-12] Nhận tại cửa hàng — đang chuẩn bị hàng',
    branchId: BRANCH_HK,
    fulfillment: FulfillmentType.PICKUP,
    status: OrderStatus.PROCESSING,
    paymentStatus: PaymentStatus.PENDING,
    stockStatus: OrderStockStatus.RESERVED,
    paymentMethodCode: PaymentMethodCode.COD,
    channel: OrderChannel.ADMIN,
    recipientName: 'Lý Thị Ngọc',
    recipientPhone: '0912000012',
    items: [
      { variant: V.caphe250g, qty: 1 },
      { variant: V.macca250g, qty: 2 },
    ],
    placedDaysAgo: 1,
  },
];

async function run() {
  const ds: DataSource = await AppDataSource.initialize();
  console.log('🧹 Clearing existing orders…');

  // CASCADE removes order_items + shipments automatically.
  await ds.getRepository(Order).createQueryBuilder().delete().execute();
  console.log('  ✓ orders cleared');

  const orderRepo = ds.getRepository(Order);
  const itemRepo = ds.getRepository(OrderItem);
  const shipRepo = ds.getRepository(Shipment);

  console.log('\n🌱 Seeding test cases…');

  for (const tc of TEST_CASES) {
    const lineItems = tc.items.map((i) => ({
      variant: i.variant,
      qty: i.qty,
      lineTotal: (parseFloat(i.variant.price) * i.qty).toFixed(2),
    }));

    const shippingFee =
      tc.fulfillment === FulfillmentType.DELIVERY ? 30_000 : 0;
    const subtotal = lineItems.reduce(
      (s, i) => s + parseFloat(i.variant.price) * i.qty,
      0,
    );

    const addr = tc.address
      ? { ...tc.address, recipientName: tc.recipientName, phone: tc.recipientPhone }
      : undefined;

    const placedAt = daysAgo(tc.placedDaysAgo);

    const order = await orderRepo.save(
      orderRepo.create({
        code: tc.code,
        branchId: tc.branchId,
        fulfillment: tc.fulfillment,
        status: tc.status,
        paymentStatus: tc.paymentStatus,
        stockStatus: tc.stockStatus,
        paymentMethodCode: tc.paymentMethodCode,
        channel: tc.channel,
        recipientName: tc.recipientName,
        recipientPhone: tc.recipientPhone,
        shippingAddress: addr,
        subtotal: subtotal.toFixed(2),
        shippingFee: shippingFee.toFixed(2),
        discountTotal: '0.00',
        grandTotal: (subtotal + shippingFee).toFixed(2),
        currency: 'VND',
        notes: tc.label,
        placedAt,
        items: [],
      }),
    );

    await itemRepo.save(
      lineItems.map((i) =>
        itemRepo.create({
          orderId: order.id,
          variantId: i.variant.id,
          productName: i.variant.name,
          variantTitle: i.variant.title,
          sku: i.variant.sku,
          unitPrice: i.variant.price,
          quantity: i.qty,
          lineTotal: i.lineTotal,
          imageUrl: i.variant.img,
        }),
      ),
    );

    if (tc.shipment) {
      await shipRepo.save(
        shipRepo.create({
          orderId: order.id,
          ...tc.shipment,
        }),
      );
    }

    const shipLabel = tc.shipment ? ` + shipment [${tc.shipment.status}]` : '';
    console.log(`  ✓ ${tc.code}${shipLabel}`);
  }

  await ds.destroy();
  console.log(`\n✅ ${TEST_CASES.length} test cases seeded`);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
