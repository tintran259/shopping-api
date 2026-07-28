import { BranchScopeCtx } from '../../common/decorators/branch-scope.decorator';
import { OrderStatus, PaymentStatus, ShipmentStatus } from '../../common/enums';
import { AdminOrderQueryDto } from '../orders/dto/admin-order-query.dto';
import { BranchesService } from '../branches/services/branches.service';
import { InventoryService } from '../branches/services/inventory.service';
import { OrdersService } from '../orders/services/orders.service';

/** Ngữ cảnh phân quyền của tài khoản đang chat (đã giải quyết từ DB). */
export interface AssistantCtx {
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
  scope: BranchScopeCtx;
}

/** Các service mà tool được phép gọi (read-only ở v1). */
export interface ToolServices {
  orders: OrdersService;
  inventory: InventoryService;
  branches: BranchesService;
}

export interface AssistantTool {
  name: string;
  description: string;
  /** Quyền `<feature>.<action>` cần có để tool được đưa cho model. Bỏ trống = ai cũng dùng. */
  requiredPermission?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (
    args: Record<string, unknown>,
    ctx: AssistantCtx,
    s: ToolServices,
  ) => Promise<unknown>;
}

/** Đơn "gặp sự cố" = vận đơn ở các trạng thái bất thường. */
const PROBLEM_SHIPMENT_STATUSES = [
  ShipmentStatus.PROBLEM,
  ShipmentStatus.RETURNED,
  ShipmentStatus.PICKUP_FAILED,
];

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/** Dựng AdminOrderQueryDto (giữ getter `skip` + default) từ tham số tool. */
function orderQuery(fields: Partial<AdminOrderQueryDto>): AdminOrderQueryDto {
  return Object.assign(new AdminOrderQueryDto(), {
    page: 1,
    limit: 10,
    sortBy: 'placedAt',
    sortOrder: 'DESC',
    ...fields,
  });
}

/** Rút gọn 1 đơn để trả cho model (tránh nhồi payload lớn). */
const compactOrder = (o: {
  code: string;
  status: string;
  paymentStatus: string;
  shipmentStatus?: string | null;
  grandTotal: string;
  recipientName: string;
  branchId: string;
  placedAt?: string | Date;
  createdAt: string | Date;
}) => ({
  code: o.code,
  status: o.status,
  paymentStatus: o.paymentStatus,
  shipmentStatus: o.shipmentStatus ?? null,
  grandTotal: o.grandTotal,
  recipientName: o.recipientName,
  branchId: o.branchId,
  placedAt: o.placedAt ?? o.createdAt,
});

/**
 * Registry tool read-only cho trợ lý BO. Mỗi tool khai báo `requiredPermission`;
 * `AssistantService` chỉ đưa cho model những tool mà tài khoản hiện tại có quyền,
 * và mọi tool truyền `ctx.scope` vào service ⇒ backend tự lọc theo chi nhánh.
 */
export const ASSISTANT_TOOLS: AssistantTool[] = [
  {
    name: 'get_order_summary',
    description:
      'Tổng hợp đơn hàng trong khoảng thời gian: tổng số đơn, doanh thu ĐÃ THU ' +
      '(đơn đã thanh toán), và số đơn theo từng trạng thái. Dùng cho câu hỏi về ' +
      'doanh thu/số lượng đơn theo ngày/tháng.',
    requiredPermission: 'orders.view',
    inputSchema: {
      type: 'object',
      properties: {
        dateFrom: {
          type: 'string',
          description: 'ISO datetime, tính từ (inclusive)',
        },
        dateTo: {
          type: 'string',
          description: 'ISO datetime, tính đến (exclusive)',
        },
        branchId: {
          type: 'string',
          description: 'UUID chi nhánh (bỏ trống = mọi chi nhánh được phép)',
        },
      },
    },
    execute: (a, ctx, s) =>
      s.orders.summary(
        {
          dateFrom: str(a.dateFrom),
          dateTo: str(a.dateTo),
          branchId: str(a.branchId),
        },
        ctx.scope,
      ),
  },
  {
    name: 'get_best_selling_products',
    description:
      'Danh sách sản phẩm bán chạy nhất theo số lượng bán (đơn đã thanh toán) ' +
      'trong khoảng thời gian. Trả về tên sản phẩm, số lượng bán, doanh thu.',
    requiredPermission: 'orders.view',
    inputSchema: {
      type: 'object',
      properties: {
        dateFrom: { type: 'string', description: 'ISO datetime từ' },
        dateTo: { type: 'string', description: 'ISO datetime đến' },
        branchId: { type: 'string', description: 'UUID chi nhánh' },
        limit: {
          type: 'number',
          description: 'Số sản phẩm (mặc định 10, tối đa 50)',
        },
      },
    },
    execute: (a, ctx, s) =>
      s.orders.bestSellers(
        {
          dateFrom: str(a.dateFrom),
          dateTo: str(a.dateTo),
          branchId: str(a.branchId),
          limit: num(a.limit),
        },
        ctx.scope,
      ),
  },
  {
    name: 'search_orders',
    description:
      'Tìm/lọc đơn hàng theo trạng thái đơn, trạng thái thanh toán, trạng thái ' +
      'vận chuyển, hoặc từ khóa (mã đơn/tên/SĐT). Trả về danh sách rút gọn mới nhất.',
    requiredPermission: 'orders.view',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: Object.values(OrderStatus) },
        paymentStatus: { type: 'string', enum: Object.values(PaymentStatus) },
        shipmentStatus: { type: 'string', enum: Object.values(ShipmentStatus) },
        q: { type: 'string', description: 'Từ khóa: mã đơn / tên / SĐT' },
        limit: {
          type: 'number',
          description: 'Số dòng (mặc định 10, tối đa 50)',
        },
      },
    },
    execute: async (a, ctx, s) => {
      const res = await s.orders.findAll(
        orderQuery({
          status: a.status as OrderStatus | undefined,
          paymentStatus: a.paymentStatus as PaymentStatus | undefined,
          shipmentStatus: a.shipmentStatus as ShipmentStatus | undefined,
          q: str(a.q),
          limit: Math.min(num(a.limit) ?? 10, 50),
        }),
        ctx.scope,
      );
      return { total: res.meta.total, orders: res.data.map(compactOrder) };
    },
  },
  {
    name: 'list_problem_shipments',
    description:
      'Liệt kê các đơn ĐANG GẶP SỰ CỐ vận chuyển: hoàn hàng (returned), sự cố ' +
      '(problem), không lấy được hàng (pickup_failed). Dùng cho câu hỏi "đơn nào ' +
      'gặp sự cố / giao thất bại".',
    requiredPermission: 'orders.view',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Số dòng mỗi loại (mặc định 10)',
        },
      },
    },
    execute: async (a, ctx, s) => {
      const limit = Math.min(num(a.limit) ?? 10, 50);
      const groups = await Promise.all(
        PROBLEM_SHIPMENT_STATUSES.map(async (shipmentStatus) => {
          const res = await s.orders.findAll(
            orderQuery({ shipmentStatus, limit }),
            ctx.scope,
          );
          return {
            shipmentStatus,
            total: res.meta.total,
            orders: res.data.map(compactOrder),
          };
        }),
      );
      return groups.filter((g) => g.total > 0);
    },
  },
  {
    name: 'get_pending_review_orders',
    description:
      'Đếm số đơn ĐANG CHỜ DUYỆT (status = pending) và số đơn đã chờ quá 2 ngày ' +
      '(tồn đọng). Dùng cho câu hỏi "còn bao nhiêu đơn chờ duyệt / đơn tồn đọng".',
    requiredPermission: 'orders.view',
    inputSchema: {
      type: 'object',
      properties: {
        branchId: { type: 'string', description: 'UUID chi nhánh' },
      },
    },
    execute: (a, ctx, s) =>
      s.orders.pendingReview({ branchId: str(a.branchId) }, ctx.scope),
  },
  {
    name: 'list_low_stock',
    description:
      'Liệt kê mặt hàng (biến thể × chi nhánh) TỒN KHO THẤP: available = ' +
      'quantity − reserved ≤ ngưỡng. threshold=0 ⇒ đã HẾT HÀNG. Dùng cho câu hỏi ' +
      '"sản phẩm nào hết hàng / sắp hết hàng".',
    requiredPermission: 'inventory.view',
    inputSchema: {
      type: 'object',
      properties: {
        threshold: {
          type: 'number',
          description: 'Ngưỡng available (mặc định 0 = đã hết)',
        },
        branchId: { type: 'string', description: 'UUID chi nhánh' },
        limit: {
          type: 'number',
          description: 'Số dòng (mặc định 20, tối đa 100)',
        },
      },
    },
    execute: (a, ctx, s) =>
      s.inventory.lowStock(
        {
          threshold: num(a.threshold),
          branchId: str(a.branchId),
          limit: num(a.limit),
        },
        ctx.scope,
      ),
  },
  {
    name: 'list_branches',
    description:
      'Danh sách chi nhánh (id + tên) trong phạm vi tài khoản. Dùng để tra id chi ' +
      'nhánh trước khi lọc các tool khác theo chi nhánh, hoặc gọi tên chi nhánh.',
    inputSchema: { type: 'object', properties: {} },
    execute: async (_a, ctx, s) => {
      const branches = await s.branches.findAll();
      const scoped = ctx.scope.allBranches
        ? branches
        : branches.filter((b) => ctx.scope.branchIds.includes(b.id));
      return scoped.map((b) => ({ id: b.id, name: b.name }));
    },
  },
];
