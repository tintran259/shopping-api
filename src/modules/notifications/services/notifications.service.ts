import { Injectable } from '@nestjs/common';
import { SubscribeBackInStockDto } from '../dto/subscribe.dto';
import { BackInStockSubscription } from '../entities/back-in-stock-subscription.entity';
import { NotificationsRepository } from '../repositories/notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(private readonly notifications: NotificationsRepository) {}

  subscribeBackInStock(
    dto: SubscribeBackInStockDto,
  ): Promise<BackInStockSubscription> {
    return this.notifications.save(this.notifications.create(dto));
  }
}
