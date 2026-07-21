import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BackInStockSubscription } from '../entities/back-in-stock-subscription.entity';

@Injectable()
export class NotificationsRepository {
  constructor(
    @InjectRepository(BackInStockSubscription)
    private readonly repo: Repository<BackInStockSubscription>,
  ) {}

  create(data: Partial<BackInStockSubscription>): BackInStockSubscription {
    return this.repo.create(data);
  }

  save(sub: BackInStockSubscription): Promise<BackInStockSubscription> {
    return this.repo.save(sub);
  }

  /**
   * Finds a pending (not yet notified) subscription matching the exact
   * (variantId, contact, branchId) triple. Used to prevent duplicate rows
   * when the same user clicks the button more than once.
   */
  findExisting(
    variantId: string,
    contact: string,
    branchId?: string,
  ): Promise<BackInStockSubscription | null> {
    return this.repo.findOne({
      where: {
        variantId,
        contact,
        branchId: branchId ?? IsNull(),
        notifiedAt: IsNull(),
      },
    });
  }

  /**
   * Returns all pending subscriptions for a variant that should be notified
   * when `branchId` has stock again:
   *  - subscriptions scoped to that exact branch
   *  - subscriptions with no branch filter (branchId IS NULL) — "any branch"
   *
   * When `branchId` is undefined (e.g. product-level restock), only
   * branch-agnostic subscriptions are returned.
   */
  findPending(
    variantId: string,
    branchId?: string,
  ): Promise<BackInStockSubscription[]> {
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.variantId = :variantId', { variantId })
      .andWhere('s.notifiedAt IS NULL');

    if (branchId) {
      qb.andWhere('(s.branchId = :branchId OR s.branchId IS NULL)', { branchId });
    } else {
      qb.andWhere('s.branchId IS NULL');
    }

    return qb.getMany();
  }

  /**
   * Stamps `notifiedAt = NOW()` on a batch of subscriptions after their
   * emails have been dispatched, so they are never notified twice for the
   * same stock cycle.
   */
  async markNotified(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.repo
      .createQueryBuilder()
      .update(BackInStockSubscription)
      .set({ notifiedAt: new Date() })
      .whereInIds(ids)
      .execute();
  }

  /**
   * Links all pending guest subscriptions for a given email to a newly
   * created customer account. Called right after registration so the
   * customer doesn't have to re-subscribe for items they were already
   * watching as a guest.
   */
  async claimByEmail(email: string, customerId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(BackInStockSubscription)
      .set({ customerId })
      .where('contact = :email', { email })
      .andWhere('customer_id IS NULL')
      .execute();
  }
}
