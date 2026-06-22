import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryStatus } from '../../../common/enums';
import { InventoryService } from '../../branches/services/inventory.service';
import { ProductsService } from '../../catalog/services/products.service';
import { AddCartItemDto, UpdateCartItemDto } from '../dto/cart.dto';
import { Cart } from '../entities/cart.entity';
import { CartRepository } from '../repositories/cart.repository';

@Injectable()
export class CartService {
  constructor(
    private readonly carts: CartRepository,
    private readonly products: ProductsService,
    private readonly inventory: InventoryService,
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
    const variant = await this.products.getVariantOrFail(dto.variantId);
    if (!variant.isActive) throw new BadRequestException('Variant unavailable');

    if (dto.branchId && dto.branchId !== cart.branchId) {
      await this.carts.setBranch(cart.id, dto.branchId);
      cart.branchId = dto.branchId;
    }

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

  async updateItem(customerId: string, itemId: string, dto: UpdateCartItemDto) {
    const cart = await this.getActiveCart(customerId);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Cart item not found');

    if (dto.quantity === 0) {
      await this.carts.removeItem(item);
      return this.view(customerId);
    }
    await this.assertStock(cart.branchId, item.variantId, dto.quantity);
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
    if (record.status !== InventoryStatus.PREORDER && record.quantity < qty) {
      throw new BadRequestException(`Only ${record.quantity} in stock`);
    }
  }

  serialize(cart: Cart) {
    const items = (cart.items ?? []).map((i) => ({
      id: i.id,
      variantId: i.variantId,
      sku: i.variant?.sku,
      productName: i.variant?.product?.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: (Number(i.unitPrice) * i.quantity).toFixed(2),
    }));
    const subtotal = items.reduce((sum, i) => sum + Number(i.lineTotal), 0);
    return {
      id: cart.id,
      status: cart.status,
      branchId: cart.branchId,
      currency: cart.currency,
      items,
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: subtotal.toFixed(2),
    };
  }
}
