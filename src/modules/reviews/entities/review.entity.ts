import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ReviewStatus } from '../../../common/enums';
import { Customer } from '../../customers/entities/customer.entity';
import { Product } from '../../catalog/entities/product.entity';

@Entity('reviews')
export class Review extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Index()
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  /** Reuses the existing `product_id` column — admin moderation needs the
   *  product name/slug, storefront read/write paths never load it. */
  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  /** Reuses the existing `customer_id` column — same reasoning as `product`. */
  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Column({ type: 'int' })
  rating: number;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  title?: string;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  body?: string;

  @ApiProperty({ enum: ReviewStatus })
  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.PENDING })
  status: ReviewStatus;
}
