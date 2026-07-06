import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, EntityManager, Repository } from 'typeorm';
import {
  AdminVoucherQueryDto,
  VOUCHER_STATE_VALUES,
  VoucherState,
  VoucherStateCounts,
} from '../dto/admin-voucher-query.dto';
import { Voucher } from '../entities/voucher.entity';
import { VoucherRedemption } from '../entities/voucher-redemption.entity';

/** A voucher row for the admin list, with scoping arrays reduced to their
 *  counts — the list only ever shows "N sản phẩm / N chi nhánh / N khách",
 *  never the members themselves, so loading the full arrays (which would also
 *  break skip/take pagination once a voucher has many rows on a to-many side)
 *  is unnecessary. Full arrays are still loaded by `findById` for the edit form. */
export type VoucherListRow = Voucher & {
  productsCount: number;
  branchesCount: number;
  customersCount: number;
};

/** Relations loaded everywhere — these tables are tiny and evaluate() (the
 *  checkout hot path) needs them anyway to check scoping restrictions.
 *  `products.images` is nested in too so the admin combo picker can show a
 *  thumbnail, not just the product name. */
const SCOPE_RELATIONS = {
  products: { images: true },
  branches: true,
  customers: true,
};

@Injectable()
export class VouchersRepository {
  constructor(
    @InjectRepository(Voucher)
    private readonly vouchers: Repository<Voucher>,
    @InjectRepository(VoucherRedemption)
    private readonly redemptions: Repository<VoucherRedemption>,
  ) {}

  create(data: DeepPartial<Voucher>): Voucher {
    return this.vouchers.create(data);
  }

  save(voucher: Voucher): Promise<Voucher> {
    return this.vouchers.save(voucher);
  }

  remove(voucher: Voucher): Promise<Voucher> {
    return this.vouchers.remove(voucher);
  }

  findAll(): Promise<Voucher[]> {
    return this.vouchers.find({
      order: { createdAt: 'DESC' },
      relations: SCOPE_RELATIONS,
    });
  }

  /** Admin list: server-side `q` (code) + `state` filter, paginated. Uses
   *  `loadRelationCountAndMap` (a scalar subquery) instead of joining the
   *  scoping relations, so pagination counts stay correct no matter how many
   *  products/branches/customers a voucher has attached. */
  async searchAdmin(query: AdminVoucherQueryDto): Promise<[VoucherListRow[], number]> {
    const qb = this.vouchers
      .createQueryBuilder('v')
      .loadRelationCountAndMap('v.productsCount', 'v.products')
      .loadRelationCountAndMap('v.branchesCount', 'v.branches')
      .loadRelationCountAndMap('v.customersCount', 'v.customers')
      .orderBy('v.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    if (query.q) {
      qb.andWhere('v.code ILIKE :q', { q: `%${query.q}%` });
    }

    if (query.state) {
      const now = new Date();
      switch (query.state) {
        case 'disabled':
          qb.andWhere('v.isActive = false');
          break;
        case 'scheduled':
          qb.andWhere('v.isActive = true AND v.startsAt > :now', { now });
          break;
        case 'expired':
          qb.andWhere(
            'v.isActive = true AND (v.startsAt IS NULL OR v.startsAt <= :now) AND v.endsAt IS NOT NULL AND v.endsAt <= :now',
            { now },
          );
          break;
        case 'active':
          qb.andWhere(
            'v.isActive = true AND (v.startsAt IS NULL OR v.startsAt <= :now) AND (v.endsAt IS NULL OR v.endsAt > :now)',
            { now },
          );
          break;
      }
    }

    const [data, total] = await qb.getManyAndCount();
    return [data as VoucherListRow[], total];
  }

  /** One grouped COUNT for the list page's stat cards — computed in SQL (same
   *  `state` precedence as `searchAdmin`'s filter) so it reflects every
   *  voucher, not just whatever page happens to be loaded client-side. */
  async countByState(): Promise<VoucherStateCounts> {
    const rows: { state: VoucherState; count: string }[] = await this.vouchers.query(`
      SELECT
        CASE
          WHEN NOT is_active THEN 'disabled'
          WHEN starts_at IS NOT NULL AND starts_at > now() THEN 'scheduled'
          WHEN ends_at IS NOT NULL AND ends_at <= now() THEN 'expired'
          ELSE 'active'
        END AS state,
        COUNT(*) AS count
      FROM vouchers
      GROUP BY 1
    `);
    const counts = Object.fromEntries(
      VOUCHER_STATE_VALUES.map((s) => [s, 0]),
    ) as VoucherStateCounts;
    let total = 0;
    for (const row of rows) {
      const n = Number(row.count);
      counts[row.state] = n;
      total += n;
    }
    counts.total = total;
    return counts;
  }

  /** Active, non-expired, non-exhausted vouchers for the storefront picker,
   *  filtered by `customer_scope` (see `VoucherCustomerScope`):
   *  - `guests` only ever shows to a request with no customerId.
   *  - `users` only ever shows to a request with a customerId (any account).
   *  - `specific` shows if unrestricted (no `voucher_customers` rows), or —
   *    when logged in — if this customer is on that list.
   *  The customers relation is loaded so the controller can set requiresCustomer, but
   *  the actual list is never exposed in the API response. */
  findAvailable(customerId?: string): Promise<Voucher[]> {
    const now = new Date();
    const qb = this.vouchers
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.products', 'p')
      .leftJoinAndSelect('v.branches', 'b')
      .leftJoinAndSelect('v.customers', 'c')
      .where('v.isActive = true')
      .andWhere('(v.startsAt IS NULL OR v.startsAt <= :now)', { now })
      .andWhere('(v.endsAt IS NULL OR v.endsAt > :now)', { now })
      .andWhere('(v.usageLimit IS NULL OR v.usedCount < v.usageLimit)');

    if (customerId) {
      qb.andWhere(
        `(
          v.customer_scope = 'users'
          OR (
            v.customer_scope = 'specific' AND (
              NOT EXISTS (SELECT 1 FROM voucher_customers vc WHERE vc.voucher_id = v.id)
              OR EXISTS  (SELECT 1 FROM voucher_customers vc WHERE vc.voucher_id = v.id AND vc.customer_id = :customerId)
            )
          )
        )`,
        { customerId },
      );
    } else {
      qb.andWhere(
        `(
          v.customer_scope = 'guests'
          OR (
            v.customer_scope = 'specific'
            AND NOT EXISTS (SELECT 1 FROM voucher_customers vc WHERE vc.voucher_id = v.id)
          )
        )`,
      );
    }

    return qb.orderBy('v.createdAt', 'DESC').getMany();
  }

  findById(id: string): Promise<Voucher | null> {
    return this.vouchers.findOne({ where: { id }, relations: SCOPE_RELATIONS });
  }

  findByCode(code: string): Promise<Voucher | null> {
    return this.vouchers.findOne({ where: { code }, relations: SCOPE_RELATIONS });
  }

  /** How many times this customer has already redeemed this voucher — checked
   *  against `perCustomerLimit` in `VouchersService.evaluate`. Guests have no
   *  stable identity to count against, so this is only ever called with a
   *  real customerId. */
  countRedemptionsByCustomer(voucherId: string, customerId: string): Promise<number> {
    return this.redemptions.count({ where: { voucherId, customerId } });
  }

  /** Record a redemption + bump the usage counter inside the order transaction. */
  async redeem(
    manager: EntityManager,
    data: {
      voucherId: string;
      orderId: string;
      customerId?: string;
      amount: string;
    },
  ): Promise<void> {
    await manager
      .getRepository(Voucher)
      .increment({ id: data.voucherId }, 'usedCount', 1);
    await manager
      .getRepository(VoucherRedemption)
      .save(manager.getRepository(VoucherRedemption).create(data));
  }

  /** Reverse a redemption on order cancellation: decrement the usage counter and
   *  remove the redemption row so the slot (usageLimit/perCustomerLimit) is freed
   *  back up. No-op if this order never redeemed a voucher (or was already
   *  reversed) — safe to call unconditionally from cancel flows. */
  async unredeem(manager: EntityManager, orderId: string): Promise<void> {
    const redemption = await manager
      .getRepository(VoucherRedemption)
      .findOne({ where: { orderId } });
    if (!redemption) return;
    await manager
      .getRepository(Voucher)
      .decrement({ id: redemption.voucherId }, 'usedCount', 1);
    await manager.getRepository(VoucherRedemption).remove(redemption);
  }
}
