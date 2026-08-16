import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ProductVariant } from '../../catalog/entities/product-variant.entity';
import { Cart } from './cart.entity';

@Entity('cart_items')
export class CartItem extends BaseEntity {
  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart: Cart;

  @Column({ name: 'cart_id' })
  cartId: string;

  @ManyToOne(() => ProductVariant, {
    eager: true,
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'variant_id' })
  variant?: ProductVariant;

  /** Biến thể (dòng mua lẻ) — null nếu đây là dòng combo. */
  @Column({ name: 'variant_id', nullable: true })
  variantId?: string;

  /** Combo (dòng combo) — null nếu đây là dòng biến thể lẻ. */
  @ApiProperty({ required: false, format: 'uuid' })
  @Column({ name: 'combo_id', type: 'uuid', nullable: true })
  comboId?: string;

  @ApiProperty()
  @Column({ type: 'int' })
  quantity: number;

  /** Unit price snapshot at the time it was added to the cart. */
  @ApiProperty()
  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2 })
  unitPrice: string;
}
