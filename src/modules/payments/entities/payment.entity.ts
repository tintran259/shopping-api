import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { PaymentMethodCode, PaymentStatus } from '../../../common/enums';
import { Order } from '../../orders/entities/order.entity';

@Entity('payments')
export class Payment extends BaseEntity {
  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Index()
  @Column({ name: 'order_id' })
  orderId: string;

  @ApiProperty({ enum: PaymentMethodCode })
  @Column({ name: 'method_code', type: 'enum', enum: PaymentMethodCode })
  methodCode: PaymentMethodCode;

  @ApiProperty()
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @ApiProperty({ enum: PaymentStatus })
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @ApiProperty({
    required: false,
    description: 'Gateway/transaction reference',
  })
  @Column({ name: 'transaction_ref', nullable: true })
  transactionRef?: string;

  /** Raw gateway payload / metadata (webhook body, etc.). */
  @ApiProperty({ type: 'object', additionalProperties: true })
  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, unknown>;

  @ApiProperty({ required: false })
  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt?: Date;
}
