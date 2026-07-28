import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { InventoryStatus, ProductStatus } from '../../../common/enums';
import { ProductVariant } from '../../catalog/entities/product-variant.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { BranchScopeCtx } from '../../../common/decorators/branch-scope.decorator';
import { LowStockQueryDto } from '../dto/low-stock-query.dto';
import { UpsertInventoryDto } from '../dto/inventory.dto';
import { Inventory } from '../entities/inventory.entity';
import { InventoryRepository } from '../repositories/inventory.repository';
import { BranchesService } from './branches.service';

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
    private readonly branches: BranchesService,
  ) {}

  private readonly logger = new Logger(InventoryService.name);

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

  /** Tồn kho thấp (available ≤ threshold), lọc theo phạm vi chi nhánh. */
  lowStock(query: LowStockQueryDto, scope?: BranchScopeCtx) {
    return this.inventory.lowStock({
      threshold: query.threshold ?? 0,
      branchId: query.branchId,
      allowedBranchIds:
        scope && !scope.allBranches ? scope.branchIds : undefined,
      limit: query.limit ?? 20,
    });
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
      relations: { product: { images: true } },
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

    // Snapshot available (= quantity − reserved) before mutation.
    // Notification fires when available goes 0 → >0, not when raw quantity
    // changes — a branch can have quantity > 0 but available = 0 when all
    // units are reserved by pending orders.
    const prevAvailable = Math.max(
      0,
      (record.quantity ?? 0) - (record.reserved ?? 0),
    );

    // Tồn kho không được thấp hơn số đang được giữ (reserved) bởi các đơn chưa
    // hoàn tất — nếu không, `available = quantity − reserved` sẽ âm và kho bị
    // "bán khống". VD: quantity 5, reserved 5 ⇒ chỉ được chỉnh xuống tối thiểu 5.
    const reserved = record.reserved ?? 0;
    if (dto.quantity < reserved) {
      throw new BadRequestException(
        `Không thể đặt tồn kho về ${dto.quantity}: hiện có ${reserved} đơn vị đang được giữ bởi đơn hàng chưa hoàn tất. ` +
          `Số lượng tồn phải ≥ ${reserved}.`,
      );
    }

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

    // Notify subscribers when available goes from 0 to >0 (restock).
    const savedAvailable = Math.max(0, saved.quantity - (saved.reserved ?? 0));
    if (prevAvailable === 0 && savedAvailable > 0) {
      void this.dispatchRestockEmail(variant, dto.branchId);
    }

    return saved;
  }

  /** Gom thông tin sản phẩm đầy đủ (ảnh, giá, mô tả, tên chi nhánh) rồi bắn
   *  email back-in-stock cho người đăng ký. Fire-and-forget: mọi lỗi tra cứu/
   *  gửi đều được nuốt để không ảnh hưởng tới việc ghi tồn kho. */
  private async dispatchRestockEmail(
    variant: ProductVariant,
    branchId: string,
  ): Promise<void> {
    try {
      const product = variant.product;
      const imageUrl =
        variant.imageUrl ??
        product.images?.find((i) => i.isPrimary)?.url ??
        product.images?.[0]?.url;
      const branchName = await this.branches
        .findOne(branchId)
        .then((b) => b?.name)
        .catch(() => undefined);

      await this.notifications.dispatchBackInStock(variant.id, branchId, {
        productName: product.name,
        productSlug: product.slug,
        branchName,
        imageUrl,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        currency: product.currency,
        shortDescription: product.shortDescription,
      });
    } catch (err) {
      this.logger.error(`dispatchRestockEmail thất bại: ${String(err)}`);
    }
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
