import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ReviewStatus } from '../../../common/enums';

@Entity('reviews')
export class Review extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Index()
  @Column({ name: 'product_id' })
  productId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'customer_id' })
  customerId: string;

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
