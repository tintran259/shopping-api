import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { PaginatedResult } from '../../common/dto/paginated-result';
import {
  CustomerRole,
  CustomerStatus,
  NotificationType,
} from '../../common/enums';
import { Customer } from '../customers/entities/customer.entity';
import { Order } from '../orders/entities/order.entity';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationSettingItemDto } from './dto/update-settings.dto';
import { NotificationSetting } from './entities/notification-setting.entity';
import { Notification, NotificationData } from './entities/notification.entity';
import { NotificationsGateway } from './notifications.gateway';

/** Nội dung một thông báo (không gồm người nhận) — do builder theo loại tạo ra. */
interface NotificationContent {
  title: string;
  body: string;
  link?: string;
  data?: NotificationData;
}

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(NotificationSetting)
    private readonly settings: Repository<NotificationSetting>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    private readonly gateway: NotificationsGateway,
  ) {}

  // ── Producers ──────────────────────────────────────────────────────────────

  /** Đơn storefront mới → thông báo cho super admin + admin của chi nhánh đó. */
  async notifyOrderCreated(order: Order, branchName: string): Promise<void> {
    const recipients = await this.resolveBranchRecipients(order.branchId);
    await this.dispatch(NotificationType.ORDER, recipients, {
      title: 'Đơn hàng mới',
      body: `Có đơn hàng mới #${order.code} tại ${branchName}`,
      link: `/orders/${order.id}`,
      data: {
        orderId: order.id,
        orderCode: order.code,
        branchId: order.branchId,
        branchName,
      },
    });
  }

  /**
   * Đánh giá sản phẩm điểm thấp (≤2★) → cảnh báo super admin + admin chi nhánh
   * của đơn (nếu review gắn đơn); review không gắn đơn thì chỉ super admin /
   * admin "mọi chi nhánh". Click → trang Đánh giá để xử lý (duyệt/ẩn/liên hệ).
   */
  async notifyLowRating(params: {
    reviewId: string;
    productId: string;
    productName: string;
    rating: number;
    branchId?: string;
  }): Promise<void> {
    const recipients = await this.resolveBranchRecipients(params.branchId);
    await this.dispatch(NotificationType.REVIEW, recipients, {
      title: 'Đánh giá thấp',
      body: `Sản phẩm "${params.productName}" bị đánh giá ${params.rating}★`,
      link: '/reviews',
      data: {
        reviewId: params.reviewId,
        productId: params.productId,
        rating: params.rating,
        branchId: params.branchId,
      },
    });
  }

  /**
   * Lõi fan-out dùng chung cho mọi loại: lọc theo settings (vắng row = BẬT), bulk
   * insert mỗi recipient một row, rồi đẩy realtime. Thêm loại mới chỉ cần một
   * producer gọi hàm này với `NotificationContent` tương ứng.
   */
  private async dispatch(
    type: NotificationType,
    recipientIds: string[],
    content: NotificationContent,
  ): Promise<void> {
    const allowed = await this.filterBySettings(recipientIds, type);
    if (allowed.length === 0) return;

    const rows = await this.notifications.save(
      allowed.map((recipientId) =>
        this.notifications.create({ recipientId, type, ...content }),
      ),
    );

    for (const row of rows) {
      const count = await this.unreadCount(row.recipientId);
      this.gateway.emitToUser(row.recipientId, row, count.count);
    }
  }

  /**
   * Super admin + admin "mọi chi nhánh" luôn nhận; admin phạm vi chi nhánh chỉ
   * nhận khi `branchId` khớp. `branchId` undefined ⇒ chỉ super admin / mọi-chi-nhánh
   * (sự kiện không gắn chi nhánh cụ thể, vd review không kèm đơn).
   */
  private async resolveBranchRecipients(branchId?: string): Promise<string[]> {
    const users = await this.customers.find({
      where: [
        { role: CustomerRole.ADMIN, status: CustomerStatus.ACTIVE },
        { role: CustomerRole.SUPER_ADMIN, status: CustomerStatus.ACTIVE },
      ],
      relations: { staffRole: true },
      select: { id: true, role: true },
    });
    return users
      .filter(
        (u) =>
          u.role === CustomerRole.SUPER_ADMIN ||
          u.staffRole?.allBranches ||
          (branchId != null &&
            (u.staffRole?.branchIds ?? []).includes(branchId)),
      )
      .map((u) => u.id);
  }

  /** Bỏ những recipient đã tắt loại này (row `enabled=false`). Vắng row = BẬT. */
  private async filterBySettings(
    recipientIds: string[],
    type: NotificationType,
  ): Promise<string[]> {
    if (recipientIds.length === 0) return [];
    const rows = await this.settings.find({
      where: { customerId: In(recipientIds), type },
    });
    const disabled = new Set(
      rows.filter((r) => !r.enabled).map((r) => r.customerId),
    );
    return recipientIds.filter((id) => !disabled.has(id));
  }

  // ── Personal (Notification Center) ──────────────────────────────────────────

  list(userId: string, query: NotificationQueryDto) {
    const where: FindOptionsWhere<Notification> = { recipientId: userId };
    if (query.unreadOnly) where.readAt = IsNull();
    if (query.type) where.type = query.type;
    return this.notifications
      .findAndCount({
        where,
        order: { createdAt: 'DESC' },
        skip: query.skip,
        take: query.limit,
      })
      .then(
        ([data, total]) =>
          new PaginatedResult(data, total, query.page, query.limit),
      );
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notifications.count({
      where: { recipientId: userId, readAt: IsNull() },
    });
    return { count };
  }

  async markRead(userId: string, id: string): Promise<{ count: number }> {
    await this.notifications.update(
      { id, recipientId: userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return this.unreadCount(userId);
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    await this.notifications.update(
      { recipientId: userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return { count: 0 };
  }

  /** Trả trạng thái mọi loại (merge mặc định BẬT). */
  async getSettings(
    userId: string,
  ): Promise<{ type: NotificationType; enabled: boolean }[]> {
    const rows = await this.settings.find({ where: { customerId: userId } });
    const map = new Map(rows.map((r) => [r.type, r.enabled]));
    return Object.values(NotificationType).map((type) => ({
      type,
      enabled: map.get(type) ?? true,
    }));
  }

  async updateSettings(userId: string, items: NotificationSettingItemDto[]) {
    if (items.length > 0) {
      await this.settings.upsert(
        items.map((i) => ({
          customerId: userId,
          type: i.type,
          enabled: i.enabled,
        })),
        ['customerId', 'type'],
      );
    }
    return this.getSettings(userId);
  }
}
