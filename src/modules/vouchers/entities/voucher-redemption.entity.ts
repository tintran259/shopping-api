import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Voucher } from './voucher.entity';

@Entity('voucher_redemptions')
export class VoucherRedemption extends BaseEntity {
  @ManyToOne(() => Voucher, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'voucher_id' })
  voucher: Voucher;

  @Index()
  @Column({ name: 'voucher_id' })
  voucherId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId?: string;

  @ApiProperty()
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;
}
