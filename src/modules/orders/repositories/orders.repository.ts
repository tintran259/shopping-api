import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThan, Not, Repository } from 'typeorm';
import {
  OrderStatus,
  OrderStockStatus,
  PaymentMethodCode,
  PaymentStatus,
  ShipmentStatus,
} from '../../../common/enums';
import { Order } from '../entities/order.entity';

@Injectable()
export class OrdersRepository {
  constructor(
    @InjectRepository(Order)
    private readonly repo: Repository<Order>,
  ) {}

  /** Persist the order (+ nested items via cascade) inside the checkout transaction. */
  createInTx(manager: EntityManager, data: Partial<Order>): Promise<Order> {
    const repo = manager.getRepository(Order);
    return repo.save(repo.create(data));
  }

  save(order: Order): Promise<Order> {
    return this.repo.save(order);
  }

  async paginate(
    where: Record<string, unknown>,
    skip: number,
    take: number,
  ): Promise<[Order[], number]> {
    return this.repo.findAndCount({
      where,
      relations: ['branch'],
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
  }

  /**
   * Admin order search: server-side branch/status/payment filters, free-text
   * `q` (code/recipient), sort + pagination. `sortBy` is validated by the DTO
   * allowlist, so interpolating it into the ORDER BY is safe.
   */
  async searchAdmin(
    filters: {
      branchId?: string;
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      shipmentStatus?: ShipmentStatus;
      q?: string;
    },
    sort: { by: string; order: 'ASC' | 'DESC' },
    skip: number,
    take: number,
  ): Promise<[Order[], number]> {
    const qb = this.repo.createQueryBuilder('o');

    if (filters.branchId) {
      qb.andWhere('o.branchId = :branchId', { branchId: filters.branchId });
    }
    if (filters.status) {
      qb.andWhere('o.status = :status', { status: filters.status });
    }
    if (filters.paymentStatus) {
      qb.andWhere('o.paymentStatus = :paymentStatus', {
        paymentStatus: filters.paymentStatus,
      });
    }
    if (filters.shipmentStatus) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM shipments s WHERE s.order_id = o.id AND s.status = :shipmentStatus)`,
        { shipmentStatus: filters.shipmentStatus },
      );
    }
    if (filters.q) {
      qb.andWhere(
        '(o.code ILIKE :q OR o.recipientName ILIKE :q OR o.recipientPhone ILIKE :q)',
        { q: `%${filters.q}%` },
      );
    }

    const total = await qb.clone().getCount();

    const { entities, raw } = await qb
      .addSelect(
        (sub) =>
          sub
            .select('s.status')
            .from('shipments', 's')
            .where('s.order_id = o.id')
            .andWhere('s.carrier IS NOT NULL')
            .limit(1),
        'shipmentStatus',
      )
      .orderBy(`o.${sort.by}`, sort.order)
      .skip(skip)
      .take(take)
      .getRawAndEntities();

    const data = entities.map((order, i) => {
      order.shipmentStatus = (raw[i]?.shipmentStatus as string) ?? null;
      return order;
    });

    return [data, total];
  }

  /** Fresh, filtered query builder shared by every `summary()` aggregate below. */
  private summaryQuery(filters: {
    branchId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const qb = this.repo.createQueryBuilder('o');
    if (filters.branchId) {
      qb.andWhere('o.branchId = :branchId', { branchId: filters.branchId });
    }
    if (filters.dateFrom) {
      qb.andWhere('o.placedAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('o.placedAt < :dateTo', { dateTo: filters.dateTo });
    }
    return qb;
  }

  /** Dashboard aggregate: order count, PAID revenue, per-status breakdown, and a
   *  daily PAID-revenue series — all computed in SQL (COUNT/SUM/GROUP BY), so it
   *  stays correct regardless of how many orders fall in the range (unlike the
   *  paginated list, capped at `limit`). */
  async summary(filters: {
    branchId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    // The four aggregates are independent — run them in parallel.
    const [totalOrders, revenueRow, statusRows, seriesRows] = await Promise.all(
      [
        this.summaryQuery(filters).getCount(),

        this.summaryQuery(filters)
          .andWhere('o.paymentStatus = :paid', { paid: PaymentStatus.PAID })
          .select('COALESCE(SUM(o.grandTotal), 0)', 'revenue')
          .getRawOne<{ revenue: string }>(),

        this.summaryQuery(filters)
          .select('o.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .groupBy('o.status')
          .getRawMany<{ status: OrderStatus; count: string }>(),

        this.summaryQuery(filters)
          .andWhere('o.paymentStatus = :paid', { paid: PaymentStatus.PAID })
          .select("TO_CHAR(o.placedAt, 'YYYY-MM-DD')", 'day')
          .addSelect('SUM(o.grandTotal)', 'revenue')
          .groupBy('day')
          .orderBy('day', 'ASC')
          .getRawMany<{ day: string; revenue: string }>(),
      ],
    );

    return {
      totalOrders,
      totalRevenue: revenueRow?.revenue ?? '0',
      statusRows,
      seriesRows,
    };
  }

  findById(id: string): Promise<Order | null> {
    return this.repo.findOne({ where: { id }, relations: ['branch'] });
  }

  findByCode(code: string): Promise<Order | null> {
    return this.repo.findOne({ where: { code }, relations: ['branch'] });
  }

  /** Prepaid orders still unpaid + holding stock, placed before `cutoff` (COD excluded). */
  findStaleUnpaid(cutoff: Date): Promise<Order[]> {
    return this.repo.find({
      where: {
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        stockStatus: OrderStockStatus.RESERVED,
        paymentMethodCode: Not(PaymentMethodCode.COD),
        placedAt: LessThan(cutoff),
      },
    });
  }
}
