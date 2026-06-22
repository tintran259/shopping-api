import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Wishlist } from './wishlist.entity';

@Entity('wishlist_items')
export class WishlistItem extends BaseEntity {
  @ManyToOne(() => Wishlist, (w) => w.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wishlist_id' })
  wishlist: Wishlist;

  @Column({ name: 'wishlist_id' })
  wishlistId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'product_id' })
  productId: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId?: string;
}
