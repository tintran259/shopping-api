import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrdersService } from './services/orders.service';

/** Releases stock held by prepaid orders that were never paid. */
@Injectable()
export class OrdersCron {
  private readonly logger = new Logger(OrdersCron.name);

  constructor(private readonly orders: OrdersService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseStaleHolds(): Promise<void> {
    try {
      const count = await this.orders.autoCancelStaleOrders(30);
      if (count) {
        this.logger.log(`Auto-cancelled ${count} stale unpaid order(s)`);
      }
    } catch (err) {
      this.logger.error('Auto-cancel sweep failed', err as Error);
    }
  }
}
