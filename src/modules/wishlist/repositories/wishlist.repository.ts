import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { Wishlist } from '../entities/wishlist.entity';

@Injectable()
export class WishlistRepository {
  constructor(
    @InjectRepository(Wishlist)
    private readonly lists: Repository<Wishlist>,
    @InjectRepository(WishlistItem)
    private readonly items: Repository<WishlistItem>,
  ) {}

  findAll(customerId: string): Promise<Wishlist[]> {
    return this.lists.find({
      where: { customerId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  findDefault(customerId: string): Promise<Wishlist | null> {
    return this.lists.findOne({ where: { customerId, isDefault: true } });
  }

  findOwn(customerId: string, id: string): Promise<Wishlist | null> {
    return this.lists.findOne({ where: { id, customerId } });
  }

  createList(data: Partial<Wishlist>): Wishlist {
    return this.lists.create(data);
  }

  saveList(list: Wishlist): Promise<Wishlist> {
    return this.lists.save(list);
  }

  createItem(data: Partial<WishlistItem>): WishlistItem {
    return this.items.create(data);
  }

  saveItem(item: WishlistItem): Promise<WishlistItem> {
    return this.items.save(item);
  }

  findItem(id: string): Promise<WishlistItem | null> {
    return this.items.findOne({ where: { id }, relations: { wishlist: true } });
  }

  removeItem(item: WishlistItem): Promise<WishlistItem> {
    return this.items.remove(item);
  }
}
