import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class PaymentsRepository {
  constructor(
    @InjectRepository(Payment)
    private readonly repo: Repository<Payment>,
  ) {}

  save(payment: Payment): Promise<Payment> {
    return this.repo.save(payment);
  }

  /** Create the payment row inside the order checkout transaction. */
  createInTx(manager: EntityManager, data: Partial<Payment>): Promise<Payment> {
    const repo = manager.getRepository(Payment);
    return repo.save(repo.create(data));
  }

  findByOrder(orderId: string): Promise<Payment[]> {
    return this.repo.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  findById(id: string): Promise<Payment | null> {
    return this.repo.findOne({ where: { id } });
  }
}
