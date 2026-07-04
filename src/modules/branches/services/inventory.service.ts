import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { InventoryStatus } from '../../../common/enums';
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

  /** Bulk variant→inventory rows for catalog list/detail (avoids N+1). */
  findForVariants(variantIds: string[]): Promise<Inventory[]> {
    return this.inventory.findForVariants(variantIds);
  }

  getRecord(branchId: string, variantId: string): Promise<Inventory | null> {
    return this.inventory.getRecord(branchId, variantId);
  }

  /**
   * Admin: create or update the stock record for (branch, variant).
   *
   * Status is derived from quantity (0 → out_of_stock, >0 → in_stock) unless
   * the caller explicitly sets one — that's how an admin opts a row into
   * `preorder` (sell ahead of physical stock) and why it isn't silently
   * reset to `in_stock`/`out_of_stock` on a later quantity-only edit. This
   * lives here, not in the FE, so quantity and status can never drift apart
   * regardless of which client calls this endpoint.
   */
  async upsert(dto: UpsertInventoryDto): Promise<Inventory> {
    const record =
      (await this.inventory.getRecord(dto.branchId, dto.variantId)) ??
      this.inventory.create({
        branchId: dto.branchId,
        variantId: dto.variantId,
      });
    record.quantity = dto.quantity;
    if (dto.status) {
      record.status = dto.status;
    } else if (record.status !== InventoryStatus.PREORDER) {
      record.status =
        dto.quantity > 0 ? InventoryStatus.IN_STOCK : InventoryStatus.OUT_OF_STOCK;
    }
    return this.inventory.save(record);
  }

  /** Hold stock at order placement (available = quantity − reserved). */
  reserve(
    manager: EntityManager,
    branchId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    return this.inventory.reserve(manager, branchId, variantId, quantity);
  }

  /** Physically deduct a reservation (payment captured / delivered). */
  commit(
    manager: EntityManager,
    branchId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    return this.inventory.commit(manager, branchId, variantId, quantity);
  }

  /** Drop a reservation without touching physical stock (cancelled before commit). */
  release(
    manager: EntityManager,
    branchId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    return this.inventory.release(manager, branchId, variantId, quantity);
  }

  /** Return already-committed stock to the shelf (cancel/refund after commit). */
  restock(
    manager: EntityManager,
    branchId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    return this.inventory.restock(manager, branchId, variantId, quantity);
  }
}
