import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { VoucherType } from '../../../common/enums';

@Entity('vouchers')
export class Voucher extends BaseEntity {
  @ApiProperty({ example: 'WELCOME15' })
  @Index({ unique: true })
  @Column()
  code: string;

  @ApiProperty({ enum: VoucherType })
  @Column({ type: 'enum', enum: VoucherType })
  type: VoucherType;

  @ApiProperty({ description: 'percent 0-100 | fixed VND | shipping VND' })
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  value: string;

  @ApiProperty({ default: 0 })
  @Column({
    name: 'min_subtotal',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  minSubtotal: string;

  @ApiProperty({ required: false, description: 'Cap for percent vouchers' })
  @Column({
    name: 'max_discount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  maxDiscount?: string;

  @ApiProperty({ required: false })
  @Column({ name: 'usage_limit', type: 'int', nullable: true })
  usageLimit?: number;

  @ApiProperty({ default: 0 })
  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @ApiProperty({ required: false })
  @Column({ name: 'per_customer_limit', type: 'int', nullable: true })
  perCustomerLimit?: number;

  @ApiProperty({ required: false })
  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt?: Date;

  @ApiProperty({ required: false })
  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt?: Date;

  @ApiProperty({ default: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
