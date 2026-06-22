import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UpsertInventoryDto } from '../dto/inventory.dto';
import { Inventory } from '../entities/inventory.entity';
import { InventoryRepository } from '../repositories/inventory.repository';

@Injectable()
export class InventoryService {
  constructor(private readonly inventory: InventoryRepository) {}

  /** Per-branch availability for a variant — powers the FE `BranchStock[]`. */
  findForVariant(variantId: string): Promise<Inventory[]> {
    return this.inventory.findForVariant(variantId);
  }

  getRecord(branchId: string, variantId: string): Promise<Inventory | null> {
    return this.inventory.getRecord(branchId, variantId);
  }

  /** Admin: create or update the stock record for (branch, variant). */
  async upsert(dto: UpsertInventoryDto): Promise<Inventory> {
    const record =
      (await this.inventory.getRecord(dto.branchId, dto.variantId)) ??
      this.inventory.create({ branchId: dto.branchId, variantId: dto.variantId });
    record.quantity = dto.quantity;
    if (dto.status) record.status = dto.status;
    return this.inventory.save(record);
  }

  /** Reserve stock during the order transaction. */
  reserve(
    manager: EntityManager,
    branchId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    return this.inventory.reserve(manager, branchId, variantId, quantity);
  }
}
