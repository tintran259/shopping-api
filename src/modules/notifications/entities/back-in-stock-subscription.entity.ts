import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('back_in_stock_subscriptions')
export class BackInStockSubscription extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Index()
  @Column({ name: 'variant_id' })
  variantId: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId?: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId?: string;

  @ApiProperty({ description: 'email or phone' })
  @Column()
  contact: string;

  @ApiProperty({ required: false })
  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt?: Date;
}
