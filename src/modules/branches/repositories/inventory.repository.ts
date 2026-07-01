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

  /** Lock the (branch, variant) row inside an existing transaction. */
  private async lockRecord(
    manager: EntityManager,
    branchId: string,
    variantId: string,
  ): Promise<Inventory> {
    const record = await manager.getRepository(Inventory).findOne({
      where: { branchId, variantId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!record) {
      throw new NotFoundException('No inventory for variant at the branch');
    }
    return record;
  }

  /** Keep `status` in sync with physical quantity (leaves PREORDER untouched). */
  private syncStatus(record: Inventory): void {
    if (record.status === InventoryStatus.PREORDER) return;
    record.status =
      record.quantity > 0
        ? InventoryStatus.IN_STOCK
        : InventoryStatus.OUT_OF_STOCK;
  }

  /** Hold stock against availability (quantity − reserved) at order placement. */
  async reserve(
    manager: EntityManager,
    branchId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    const record = await this.lockRecord(manager, branchId, variantId);
    const available = record.quantity - record.reserved;
    if (record.status !== InventoryStatus.PREORDER && available < quantity) {
      throw new BadRequestException('Insufficient stock at branch');
    }
    record.reserved += quantity;
    await manager.getRepository(Inventory).save(record);
  }

  /** Convert a reservation into a physical deduction (payment captured/delivered). */
  async commit(
    manager: EntityManager,
    branchId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    const record = await this.lockRecord(manager, branchId, variantId);
    record.reserved = Math.max(0, record.reserved - quantity);
    record.quantity = Math.max(0, record.quantity - quantity);
    this.syncStatus(record);
    await manager.getRepository(Inventory).save(record);
  }

  /** Drop a reservation without touching physical stock (cancelled before commit). */
  async release(
    manager: EntityManager,
    branchId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    const record = await this.lockRecord(manager, branchId, variantId);
    record.reserved = Math.max(0, record.reserved - quantity);
    await manager.getRepository(Inventory).save(record);
  }

  /** Return already-committed stock to the shelf (cancel/refund after commit). */
  async restock(
    manager: EntityManager,
    branchId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    const record = await this.lockRecord(manager, branchId, variantId);
    record.quantity += quantity;
    this.syncStatus(record);
    await manager.getRepository(Inventory).save(record);
  }
}
