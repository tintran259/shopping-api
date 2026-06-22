import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { PriceTier } from './price-tier.entity';
import { ProductVariant } from './product-variant.entity';

@Entity('price_list_items')
@Index(['priceTierId', 'variantId'], { unique: true })
export class PriceListItem extends BaseEntity {
  @ManyToOne(() => PriceTier, (t) => t.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'price_tier_id' })
  priceTier: PriceTier;

  @Column({ name: 'price_tier_id' })
  priceTierId: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Column({ name: 'variant_id' })
  variantId: string;

  @ApiProperty()
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: string;
}
