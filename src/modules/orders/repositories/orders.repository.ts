import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThan, Not, Repository } from 'typeorm';
import {
  OrderStatus,
  OrderStockStatus,
  PaymentMethodCode,
  PaymentStatus,
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
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
  }

  findById(id: string): Promise<Order | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByCode(code: string): Promise<Order | null> {
    return this.repo.findOne({ where: { code } });
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
