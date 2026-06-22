import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
}
