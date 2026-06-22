import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ShipmentStatus } from '../../../common/enums';
import { Order } from './order.entity';
import { ShippingMethod } from './shipping-method.entity';

@Entity('shipments')
export class Shipment extends BaseEntity {
  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => ShippingMethod, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'shipping_method_id' })
  shippingMethod?: ShippingMethod;

  @Column({ name: 'shipping_method_id', type: 'uuid', nullable: true })
  shippingMethodId?: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  carrier?: string;

  @ApiProperty({ required: false })
  @Column({ name: 'tracking_no', nullable: true })
  trackingNo?: string;

  @ApiProperty({ enum: ShipmentStatus })
  @Column({ type: 'enum', enum: ShipmentStatus, default: ShipmentStatus.PENDING })
  status: ShipmentStatus;

  @ApiProperty({ default: '0.00' })
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  fee: string;

  @ApiProperty({ required: false })
  @Column({ name: 'shipped_at', type: 'timestamptz', nullable: true })
  shippedAt?: Date;

  @ApiProperty({ required: false })
  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt?: Date;
}
