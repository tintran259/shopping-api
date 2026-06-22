import { Injectable, NotFoundException } from '@nestjs/common';
import { AddWishlistItemDto, CreateWishlistDto } from '../dto/wishlist.dto';
import { Wishlist } from '../entities/wishlist.entity';
import { WishlistRepository } from '../repositories/wishlist.repository';

@Injectable()
export class WishlistService {
  constructor(private readonly wishlists: WishlistRepository) {}

  findAll(customerId: string): Promise<Wishlist[]> {
    return this.wishlists.findAll(customerId);
  }

  /** Lazily creates a default list so the storefront always has a target. */
  async getOrCreateDefault(customerId: string): Promise<Wishlist> {
    const existing = await this.wishlists.findDefault(customerId);
    if (existing) return existing;
    return this.wishlists.saveList(
      this.wishlists.createList({ customerId, name: 'My wishlist', isDefault: true }),
    );
  }

  create(customerId: string, dto: CreateWishlistDto): Promise<Wishlist> {
    return this.wishlists.saveList(
      this.wishlists.createList({ ...dto, customerId }),
    );
  }

  async addItem(customerId: string, dto: AddWishlistItemDto): Promise<Wishlist> {
    const list = dto.wishlistId
      ? await this.ownList(customerId, dto.wishlistId)
      : await this.getOrCreateDefault(customerId);
    await this.wishlists.saveItem(
      this.wishlists.createItem({
        wishlistId: list.id,
        productId: dto.productId,
        variantId: dto.variantId,
      }),
    );
    return this.ownList(customerId, list.id);
  }

  async removeItem(customerId: string, itemId: string): Promise<void> {
    const item = await this.wishlists.findItem(itemId);
    if (!item || item.wishlist.customerId !== customerId) {
      throw new NotFoundException('Wishlist item not found');
    }
    await this.wishlists.removeItem(item);
  }

  private async ownList(customerId: string, id: string): Promise<Wishlist> {
    const list = await this.wishlists.findOwn(customerId, id);
    if (!list) throw new NotFoundException('Wishlist not found');
    return list;
  }
}
