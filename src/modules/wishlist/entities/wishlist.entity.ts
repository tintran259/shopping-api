import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { WishlistItem } from './wishlist-item.entity';

@Entity('wishlists')
export class Wishlist extends BaseEntity {
  @Index()
  @Column({ name: 'customer_id' })
  customerId: string;

  @ApiProperty()
  @Column()
  name: string;

  @ApiProperty({ default: false })
  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @OneToMany(() => WishlistItem, (i) => i.wishlist, { cascade: true, eager: true })
  items: WishlistItem[];
}
