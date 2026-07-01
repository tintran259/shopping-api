import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductsService } from '../../catalog/services/products.service';
import { ProductDto } from '../../catalog/serializers/catalog.serializer';
import {
  AddWishlistItemDto,
  CreateWishlistDto,
  UpdateWishlistDto,
} from '../dto/wishlist.dto';
import { Wishlist } from '../entities/wishlist.entity';
import { WishlistRepository } from '../repositories/wishlist.repository';
import { toWishlistDto, WishlistDto } from '../serializers/wishlist.serializer';

@Injectable()
export class WishlistService {
  constructor(
    private readonly wishlists: WishlistRepository,
    private readonly products: ProductsService,
  ) {}

  async findAll(customerId: string): Promise<WishlistDto[]> {
    const lists = await this.wishlists.findAll(customerId);
    return this.serialize(lists);
  }

  async create(
    customerId: string,
    dto: CreateWishlistDto,
  ): Promise<WishlistDto> {
    const list = await this.wishlists.saveList(
      this.wishlists.createList({ ...dto, customerId }),
    );
    return (await this.serialize([list]))[0];
  }

  async rename(
    customerId: string,
    id: string,
    dto: UpdateWishlistDto,
  ): Promise<WishlistDto> {
    const list = await this.ownList(customerId, id);
    list.name = dto.name;
    await this.wishlists.saveList(list);
    return (await this.serialize([await this.ownList(customerId, id)]))[0];
  }

  async removeList(customerId: string, id: string): Promise<void> {
    await this.wishlists.removeList(await this.ownList(customerId, id));
  }

  async addItem(
    customerId: string,
    dto: AddWishlistItemDto,
  ): Promise<WishlistDto> {
    const list = await this.ownList(customerId, dto.wishlistId);
    // Idempotent: skip if the same product (+variant) is already saved here.
    const dup = (list.items ?? []).some(
      (i) =>
        i.productId === dto.productId &&
        (i.variantId ?? null) === (dto.variantId ?? null),
    );
    if (!dup) {
      await this.wishlists.saveItem(
        this.wishlists.createItem({
          wishlistId: list.id,
          productId: dto.productId,
          variantId: dto.variantId,
        }),
      );
    }
    return (await this.serialize([await this.ownList(customerId, list.id)]))[0];
  }

  async removeItem(customerId: string, itemId: string): Promise<void> {
    const item = await this.wishlists.findItem(itemId);
    if (!item || item.wishlist.customerId !== customerId) {
      throw new NotFoundException('Wishlist item not found');
    }
    await this.wishlists.removeItem(item);
  }

  /** Attach FE-shaped products (with variant details) to a set of lists. */
  private async serialize(lists: Wishlist[]): Promise<WishlistDto[]> {
    const ids = [
      ...new Set(lists.flatMap((l) => (l.items ?? []).map((i) => i.productId))),
    ];
    const products = await this.products.detailsByIds(ids);
    const byId = new Map<string, ProductDto>(products.map((p) => [p.id, p]));
    return lists.map((l) => toWishlistDto(l, byId));
  }

  private async ownList(customerId: string, id: string): Promise<Wishlist> {
    const list = await this.wishlists.findOwn(customerId, id);
    if (!list) throw new NotFoundException('Wishlist not found');
    return list;
  }
}
