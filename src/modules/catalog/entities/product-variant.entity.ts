import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ProductOptionValue } from './product-option-value.entity';
import { Product } from './product.entity';

@Entity('product_variants')
export class ProductVariant extends BaseEntity {
  @ManyToOne(() => Product, (p) => p.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'product_id' })
  productId: string;

  @ApiProperty()
  @Index({ unique: true })
  @Column()
  sku: string;

  @ApiProperty({ description: 'Authoritative selling price' })
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: string;

  @ApiProperty({ required: false })
  @Column({
    name: 'compare_at_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  compareAtPrice?: string;

  @ApiProperty({ required: false })
  @Column({ name: 'image_url', nullable: true })
  imageUrl?: string;

  @ApiProperty({ default: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** The option values that define this variant (Đen + M). Junction = variant_option_values. */
  @ManyToMany(() => ProductOptionValue)
  @JoinTable({
    name: 'variant_option_values',
    joinColumn: { name: 'variant_id' },
    inverseJoinColumn: { name: 'option_value_id' },
  })
  optionValues: ProductOptionValue[];
}
