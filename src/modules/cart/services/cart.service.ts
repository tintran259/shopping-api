import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryStatus } from '../../../common/enums';
import { InventoryService } from '../../branches/services/inventory.service';
import { ProductsService } from '../../catalog/services/products.service';
import { CombosService } from '../../combos/services/combos.service';
import { AddCartItemDto, UpdateCartItemDto } from '../dto/cart.dto';
import { Cart } from '../entities/cart.entity';
import { CartItem } from '../entities/cart-item.entity';
import { CartRepository } from '../repositories/cart.repository';
import { CartLineDto, toCartLine } from '../serializers/cart.serializer';

/** Kết quả `CombosService.getView` (view combo cho giỏ). */
type ComboView = Awaited<ReturnType<CombosService['getView']>>;

@Injectable()
export class CartService {
  constructor(
    private readonly carts: CartRepository,
    private readonly products: ProductsService,
    private readonly inventory: InventoryService,
    private readonly combos: CombosService,
  ) {}

  async getActiveCart(customerId: string): Promise<Cart> {
    let cart = await this.carts.findActive(customerId);
    if (!cart) {
      cart = await this.carts.saveCart(
        this.carts.createCart({ customerId, items: [] }),
      );
      cart.items = [];
    }
    return cart;
  }

  async view(customerId: string) {
    return this.serialize(await this.getActiveCart(customerId));
  }

  async addItem(customerId: string, dto: AddCartItemDto) {
    const cart = await this.getActiveCart(customerId);

    if (dto.branchId && dto.branchId !== cart.branchId) {
      await this.carts.setBranch(cart.id, dto.branchId);
      cart.branchId = dto.branchId;
    }

    // Dòng combo: giá = giá combo, tồn = tồn khả dụng của combo (không theo variant).
    if (dto.comboId) {
      return this.addComboItem(customerId, cart, dto.comboId, dto.quantity);
    }
    if (!dto.variantId) {
      throw new BadRequestException('Cần variantId hoặc comboId');
    }
    const variant = await this.products.getVariantOrFail(dto.variantId);
    if (!variant.isActive) throw new BadRequestException('Variant unavailable');

    const existing = cart.items.find((i) => i.variantId === variant.id);
    const desiredQty = (existing?.quantity ?? 0) + dto.quantity;
    await this.assertStock(cart.branchId, variant.id, desiredQty);

    if (existing) {
      existing.quantity = desiredQty;
      await this.carts.saveItem(existing);
    } else {
      await this.carts.saveItem(
        this.carts.createItem({
          cartId: cart.id,
          variantId: variant.id,
          quantity: dto.quantity,
          unitPrice: variant.price,
        }),
      );
    }
    return this.view(customerId);
  }

  /** Thêm/cộng dồn một dòng combo (giá cố định, tồn = tồn khả dụng của combo). */
  private async addComboItem(
    customerId: string,
    cart: Cart,
    comboId: string,
    quantity: number,
  ) {
    const view = await this.combos.getView(comboId);
    if (!view.sellable) {
      throw new BadRequestException(
        'Combo hiện không bán (ngoài lịch hoặc đã tắt).',
      );
    }
    const existing = cart.items.find((i) => i.comboId === comboId);
    const desiredQty = (existing?.quantity ?? 0) + quantity;
    if (view.availability < desiredQty) {
      throw new BadRequestException(`Combo chỉ còn ${view.availability} bộ.`);
    }
    if (existing) {
      existing.quantity = desiredQty;
      await this.carts.saveItem(existing);
    } else {
      await this.carts.saveItem(
        this.carts.createItem({
          cartId: cart.id,
          comboId,
          quantity,
          unitPrice: view.price,
        }),
      );
    }
    return this.view(customerId);
  }

  async updateItem(customerId: string, itemId: string, dto: UpdateCartItemDto) {
    const cart = await this.getActiveCart(customerId);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Cart item not found');

    if (dto.quantity === 0) {
      await this.carts.removeItem(item);
      return this.view(customerId);
    }
    if (item.comboId) {
      const view = await this.combos.getView(item.comboId);
      if (view.availability < dto.quantity) {
        throw new BadRequestException(`Combo chỉ còn ${view.availability} bộ.`);
      }
    } else {
      await this.assertStock(cart.branchId, item.variantId!, dto.quantity);
    }
    item.quantity = dto.quantity;
    await this.carts.saveItem(item);
    return this.view(customerId);
  }

  async removeItem(customerId: string, itemId: string) {
    const cart = await this.getActiveCart(customerId);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Cart item not found');
    await this.carts.removeItem(item);
    return this.view(customerId);
  }

  async clear(customerId: string) {
    const cart = await this.getActiveCart(customerId);
    if (cart.items.length) await this.carts.removeItems(cart.items);
    return this.view(customerId);
  }

  markConverted(cartId: string): Promise<unknown> {
    return this.carts.markConverted(cartId);
  }

  private async assertStock(
    branchId: string | undefined,
    variantId: string,
    qty: number,
  ): Promise<void> {
    if (!branchId) return; // no branch chosen yet → defer to checkout
    const record = await this.inventory.getRecord(branchId, variantId);
    if (!record || record.status === InventoryStatus.OUT_OF_STOCK) {
      throw new BadRequestException('Out of stock at the selected branch');
    }
    // Sellable = physical on hand minus stock reserved by other unfulfilled orders.
    const available = Math.max(0, record.quantity - record.reserved);
    if (record.status !== InventoryStatus.PREORDER && available < qty) {
      throw new BadRequestException(`Only ${available} in stock`);
    }
  }

  /** Dòng combo hiển thị trong giỏ (gộp từ view combo — giá/tồn/tiết kiệm). */
  private comboLine(
    item: CartItem,
    view: ComboView,
    currency: string,
  ): CartLineDto {
    const price = Number(view.price);
    const original = Number(view.originalPrice);
    return {
      id: item.id,
      comboId: item.comboId,
      slug: view.slug,
      name: view.name,
      image: { url: view.imageUrl ?? undefined, alt: view.name },
      detail: `Gồm ${view.itemCount} sản phẩm`,
      price,
      compareAt: original > price ? original : null,
      currency,
      quantity: item.quantity,
      maxStock: view.availability,
      branchStock: [],
    };
  }

  /** FE-shaped cart: each line carries the full product/variant snapshot
   *  (image, price, branch stock) so the storefront renders without a refetch.
   *  Combo lines carry the combo snapshot (giá/tồn) thay cho variant. */
  async serialize(cart: Cart) {
    const items = cart.items ?? [];
    const productIds = [
      ...new Set(
        items
          .filter((i) => i.variantId)
          .map((i) => i.variant?.productId)
          .filter(Boolean),
      ),
    ] as string[];
    const products = await Promise.all(
      productIds.map((id) => this.products.detailById(id).catch(() => null)),
    );
    const byId = new Map(products.filter((p) => !!p).map((p) => [p!.id, p!]));

    const comboIds = [
      ...new Set(items.map((i) => i.comboId).filter((x): x is string => !!x)),
    ];
    const comboViews = await Promise.all(
      comboIds.map((id) => this.combos.getView(id).catch(() => null)),
    );
    const comboById = new Map(
      comboViews.filter((v): v is ComboView => !!v).map((v) => [v.id, v]),
    );

    const lines: CartLineDto[] = [];
    for (const i of items) {
      if (i.comboId) {
        const view = comboById.get(i.comboId);
        if (view) lines.push(this.comboLine(i, view, cart.currency));
      } else {
        const product = i.variant?.productId
          ? byId.get(i.variant.productId)
          : undefined;
        if (product) lines.push(toCartLine(i, product));
      }
    }

    const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
    return {
      id: cart.id,
      status: cart.status,
      branchId: cart.branchId,
      currency: cart.currency,
      lines,
      itemCount: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: subtotal.toFixed(2),
    };
  }
}
