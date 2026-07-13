import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ProductStatus } from '../../../common/enums';
import { Brand } from './brand.entity';
import { Category } from './category.entity';
import { ProductAttribute } from './product-attribute.entity';
import { ProductImage } from './product-image.entity';
import { ProductOption } from './product-option.entity';
import { ProductVariant } from './product-variant.entity';

export interface ProductFlags {
  isNew?: boolean;
  isBestSeller?: boolean;
  isFeatured?: boolean;
  isOnSale?: boolean;
}

@Entity('products')
export class Product extends BaseEntity {
  @ApiProperty()
  @Index({ unique: true })
  @Column()
  slug: string;

  @ApiProperty()
  @Column()
  name: string;

  @ManyToOne(() => Brand, (b) => b.products, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'brand_id' })
  brand?: Brand;

  @Column({ name: 'brand_id', type: 'uuid', nullable: true })
  brandId?: string;

  @ApiProperty({ enum: ProductStatus })
  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.DRAFT })
  status: ProductStatus;

  @ApiProperty({ required: false })
  @Column({ name: 'short_description', type: 'text', nullable: true })
  shortDescription?: string;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty({
    description: 'Display base price (variant holds the authoritative price)',
  })
  @Column({
    name: 'base_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  basePrice: string;

  @ApiProperty({ required: false })
  @Column({
    name: 'compare_at_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  compareAtPrice?: string;

  @ApiProperty({ default: 'VND' })
  @Column({ default: 'VND' })
  currency: string;

  @ApiProperty({ description: 'isNew|isBestSeller|isFeatured|isOnSale' })
  @Column({ type: 'jsonb', default: () => "'{}'" })
  flags: ProductFlags;

  @ApiProperty({ default: 0 })
  @Column({
    name: 'rating_avg',
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 0,
  })
  ratingAvg: string;

  @ApiProperty({ default: 0 })
  @Column({ name: 'rating_count', default: 0 })
  ratingCount: number;

  @ApiProperty({ required: false, type: 'object', additionalProperties: true })
  @Column({ type: 'jsonb', nullable: true })
  seo?: Record<string, unknown>;

  @ManyToMany(() => Category, (c) => c.products)
  @JoinTable({
    name: 'product_categories',
    joinColumn: { name: 'product_id' },
    inverseJoinColumn: { name: 'category_id' },
  })
  categories: Category[];

  @OneToMany(() => ProductImage, (i) => i.product, { cascade: true })
  images: ProductImage[];

  @OneToMany(() => ProductAttribute, (a) => a.product, { cascade: true })
  attributes: ProductAttribute[];

  @OneToMany(() => ProductOption, (o) => o.product, { cascade: true })
  options: ProductOption[];

  @OneToMany(() => ProductVariant, (v) => v.product, { cascade: true })
  variants: ProductVariant[];
}
