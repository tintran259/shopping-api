import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { InventoryStatus, ProductStatus } from '../../../common/enums';
import { ProductVariant } from '../../catalog/entities/product-variant.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { UpsertInventoryDto } from '../dto/inventory.dto';
import { Inventory } from '../entities/inventory.entity';
import { InventoryRepository } from '../repositories/inventory.repository';

/** A product in either of these states is not sellable — its stock is locked
 *  at 0 everywhere (see {@link InventoryService.upsert}) until an admin moves
 *  it out of this status from the product editor. Exported so
 *  `ProductsService.update` can check the same list before deciding to call
 *  {@link InventoryService.resetAllForProduct}. */
export const LOCKED_PRODUCT_STATUSES = [
  ProductStatus.OUT_OF_STOCK,
  ProductStatus.DISCONTINUED,
];

@Injectable()
export class InventoryService {
  constructor(
    private readonly inventory: InventoryRepository,
    @InjectRepository(ProductVariant)
    private readonly variants: Repository<ProductVariant>,
    private readonly notifications: NotificationsService,
  ) {}

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
   *
   * Blocked entirely while the parent product is `out_of_stock`/
   * `discontinued` — those statuses force every branch to 0 (see
   * {@link resetAllForProduct}, called from the product update), and letting
   * a stray PUT re-introduce quantity would silently reopen a product the
   * admin just took off sale. The admin must change the product's status
   * first; this is why the message says so instead of just rejecting.
   *
   * After a successful restock (quantity 0 → >0), fires back-in-stock
   * notifications to waiting subscribers (fire-and-forget).
   */
  async upsert(dto: UpsertInventoryDto): Promise<Inventory> {
    const variant = await this.variants.findOne({
      where: { id: dto.variantId },
      relations: { product: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    if (LOCKED_PRODUCT_STATUSES.includes(variant.product.status)) {
      const label =
        variant.product.status === ProductStatus.DISCONTINUED
          ? 'Ngừng bán'
          : 'Hết hàng';
      throw new BadRequestException(
        `Sản phẩm đang ở trạng thái "${label}" — đổi trạng thái sản phẩm trước khi chỉnh tồn kho.`,
      );
    }

    const record =
      (await this.inventory.getRecord(dto.branchId, dto.variantId)) ??
      this.inventory.create({
        branchId: dto.branchId,
        variantId: dto.variantId,
      });

    // Snapshot the previous quantity before mutation to detect a 0 → >0 restock.
    const prevQuantity: number = record.quantity ?? 0;

    record.quantity = dto.quantity;
    if (dto.status) {
      record.status = dto.status;
    } else if (record.status !== InventoryStatus.PREORDER) {
      record.status =
        dto.quantity > 0
          ? InventoryStatus.IN_STOCK
          : InventoryStatus.OUT_OF_STOCK;
    }
    const saved = await this.inventory.save(record);

    // Notify subscribers when an admin restocks a previously empty shelf.
    if (prevQuantity === 0 && saved.quantity > 0) {
      this.notifications
        .dispatchBackInStock(dto.variantId, dto.branchId, {
          productName: variant.product.name,
          productSlug: variant.product.slug,
        })
        .catch(() => undefined);
    }

    return saved;
  }

  /**
   * Force every branch's stock for a product to 0/out_of_stock — called when
   * a product's status is set to `out_of_stock`/`discontinued` (see
   * `ProductsService.update`). Goes straight to the repository (bypasses
   * {@link upsert}'s guard above on purpose: this IS the transition that
   * puts the lock in place, not a request subject to it).
   */
  async resetAllForProduct(productId: string): Promise<void> {
    const variants = await this.variants.find({
      where: { productId },
      select: ['id'],
    });
    if (!variants.length) return;
    await this.inventory.resetForVariants(variants.map((v) => v.id));
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
