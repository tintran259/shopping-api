import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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
}
