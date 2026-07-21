import { Injectable, Logger } from '@nestjs/common';
import { SubscribeBackInStockDto } from '../dto/subscribe.dto';
import { BackInStockSubscription } from '../entities/back-in-stock-subscription.entity';
import { NotificationsRepository } from '../repositories/notifications.repository';
import { BackInStockMeta, MailService } from './mail.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notifications: NotificationsRepository,
    private readonly mail: MailService,
  ) {}

  /**
   * Idempotent subscribe: if an identical pending subscription already exists
   * (same variantId + contact + branchId, not yet notified) it is returned as-is
   * so clicking the button multiple times never creates duplicate rows.
   * If the previous subscription was already notified, a fresh one is created so
   * the customer can watch the item again after a new stock cycle.
   */
  async subscribeBackInStock(
    dto: SubscribeBackInStockDto,
  ): Promise<BackInStockSubscription> {
    const existing = await this.notifications.findExisting(
      dto.variantId,
      dto.contact,
      dto.branchId,
    );
    if (existing) return existing;

    return this.notifications.save(
      this.notifications.create({
        variantId: dto.variantId,
        contact: dto.contact,
        branchId: dto.branchId,
        customerId: dto.customerId,
      }),
    );
  }

  /**
   * Sends back-in-stock emails to all pending subscribers for a variant at a
   * given branch, then marks them as notified so they are not emailed again.
   *
   * Branch-agnostic subscriptions (branchId IS NULL) are always included:
   * they represent "notify me regardless of branch".
   *
   * All emails are dispatched concurrently (Promise.allSettled). Individual
   * failures are logged but do NOT prevent the remaining emails from sending.
   * All subscriptions are stamped notifiedAt after the batch completes —
   * retry logic on per-email failure is out of scope for Phase 3.
   *
   * Callers should invoke this fire-and-forget: `.catch(() => undefined)`.
   */
  async dispatchBackInStock(
    variantId: string,
    branchId: string | undefined,
    meta: BackInStockMeta,
  ): Promise<void> {
    const subs = await this.notifications.findPending(variantId, branchId);
    if (!subs.length) return;

    this.logger.log(
      `Dispatching back-in-stock to ${subs.length} subscriber(s) for variant ${variantId}`,
    );

    const results = await Promise.allSettled(
      subs.map((s) => this.mail.sendBackInStock(s.contact, meta)),
    );

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        this.logger.error(
          `Failed to notify ${subs[i].contact}: ${String(r.reason)}`,
        );
      }
    });

    // Mark all as notified after the batch — even failed ones to avoid
    // re-notifying on every subsequent small restock. Add retry/DLQ in Phase 4.
    await this.notifications.markNotified(subs.map((s) => s.id));
  }

  /**
   * Links all pending guest subscriptions for `email` to a newly registered
   * account. Runs as fire-and-forget from CustomersService.create() — a failure
   * here must never break registration, so callers should `.catch(() => undefined)`.
   */
  claimByEmail(email: string, customerId: string): Promise<void> {
    return this.notifications.claimByEmail(email, customerId);
  }
}
