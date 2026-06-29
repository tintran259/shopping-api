import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { InventoryStatus } from '../../../common/enums';
import { Inventory } from '../entities/inventory.entity';

@Injectable()
export class InventoryRepository {
  constructor(
    @InjectRepository(Inventory)
    private readonly repo: Repository<Inventory>,
  ) {}

  create(data: Partial<Inventory>): Inventory {
    return this.repo.create(data);
  }

  save(record: Inventory): Promise<Inventory> {
    return this.repo.save(record);
  }

  findForVariant(variantId: string): Promise<Inventory[]> {
    return this.repo.find({ where: { variantId } });
  }

  /** Bulk per-variant stock for a set of variants (catalog list/detail). */
  findForVariants(variantIds: string[]): Promise<Inventory[]> {
    if (!variantIds.length) return Promise.resolve([]);
    return this.repo.find({ where: { variantId: In(variantIds) } });
  }

  getRecord(branchId: string, variantId: string): Promise<Inventory | null> {
    return this.repo.findOne({ where: { branchId, variantId } });
  }

  /**
   * Lock the (branch, variant) row inside an existing transaction and decrement
   * stock, rejecting oversell. Called by the orders checkout transaction.
   */
  async reserve(
    manager: EntityManager,
    branchId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    const repo = manager.getRepository(Inventory);
    const record = await repo.findOne({
      where: { branchId, variantId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!record) {
      throw new NotFoundException('No inventory for variant at the branch');
    }
    if (
      record.status !== InventoryStatus.PREORDER &&
      record.quantity < quantity
    ) {
      throw new BadRequestException('Insufficient stock at branch');
    }
    record.quantity -= quantity;
    await repo.save(record);
  }
}
