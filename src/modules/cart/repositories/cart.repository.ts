import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartStatus } from '../../../common/enums';
import { CartItem } from '../entities/cart-item.entity';
import { Cart } from '../entities/cart.entity';

@Injectable()
export class CartRepository {
  constructor(
    @InjectRepository(Cart)
    private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly items: Repository<CartItem>,
  ) {}

  findActive(customerId: string): Promise<Cart | null> {
    return this.carts.findOne({
      where: { customerId, status: CartStatus.ACTIVE },
      relations: { items: { variant: { product: true } } },
    });
  }

  createCart(data: Partial<Cart>): Cart {
    return this.carts.create(data);
  }

  saveCart(cart: Cart): Promise<Cart> {
    return this.carts.save(cart);
  }

  markConverted(cartId: string): Promise<unknown> {
    return this.carts.update(cartId, { status: CartStatus.CONVERTED });
  }

  /** Targeted column update — avoids cascading the (eager) items relation. */
  setBranch(cartId: string, branchId: string): Promise<unknown> {
    return this.carts.update(cartId, { branchId });
  }

  createItem(data: Partial<CartItem>): CartItem {
    return this.items.create(data);
  }

  saveItem(item: CartItem): Promise<CartItem> {
    return this.items.save(item);
  }

  removeItem(item: CartItem): Promise<CartItem> {
    return this.items.remove(item);
  }

  removeItems(items: CartItem[]): Promise<CartItem[]> {
    return this.items.remove(items);
  }
}
