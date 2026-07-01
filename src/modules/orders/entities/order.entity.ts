import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  FulfillmentType,
  OrderStatus,
  OrderStockStatus,
  PaymentMethodCode,
  PaymentStatus,
} from '../../../common/enums';
import { OrderItem } from './order-item.entity';

export interface ShippingAddressSnapshot {
  recipientName: string;
  phone: string;
  provinceCode: number;
  provinceName: string;
  wardCode: number;
  wardName: string;
  street: string;
}

/** VAT invoice request (B2B). */
export interface InvoiceSnapshot {
  companyName: string;
  taxCode: string;
  address: string;
  email: string;
}

@Entity('orders')
export class Order extends BaseEntity {
  @ApiProperty({ example: 'DHK3F8A1' })
  @Index({ unique: true })
  @Column()
  code: string;

  @ApiProperty({ required: false, format: 'uuid', description: 'null = guest' })
  @Index()
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId?: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'branch_id', type: 'uuid' })
  branchId: string;

  @ApiProperty({ enum: FulfillmentType })
  @Column({ type: 'enum', enum: FulfillmentType })
  fulfillment: FulfillmentType;

  @ApiProperty({ enum: OrderStatus })
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @ApiProperty({ enum: PaymentStatus })
  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @ApiProperty({ enum: OrderStockStatus })
  @Column({
    name: 'stock_status',
    type: 'enum',
    enum: OrderStockStatus,
    default: OrderStockStatus.RESERVED,
  })
  stockStatus: OrderStockStatus;

  @ApiProperty({ enum: PaymentMethodCode, required: false })
  @Column({ name: 'payment_method_code', type: 'varchar', nullable: true })
  paymentMethodCode?: PaymentMethodCode;

  @ApiProperty()
  @Column({ name: 'recipient_name' })
  recipientName: string;

  @ApiProperty()
  @Column({ name: 'recipient_phone' })
  recipientPhone: string;

  @ApiProperty({ required: false })
  @Column({ name: 'recipient_email', nullable: true })
  recipientEmail?: string;

  @ApiProperty({ required: false, type: 'object', additionalProperties: true })
  @Column({ name: 'shipping_address', type: 'jsonb', nullable: true })
  shippingAddress?: ShippingAddressSnapshot;

  @ApiProperty()
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  subtotal: string;

  @ApiProperty({ default: '0.00' })
  @Column({
    name: 'shipping_fee',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  shippingFee: string;

  @ApiProperty({ default: '0.00' })
  @Column({
    name: 'discount_total',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  discountTotal: string;

  @ApiProperty()
  @Column({ name: 'grand_total', type: 'numeric', precision: 12, scale: 2 })
  grandTotal: string;

  @ApiProperty({ default: 'VND' })
  @Column({ default: 'VND' })
  currency: string;

  @ApiProperty({ required: false })
  @Column({ name: 'voucher_code', nullable: true })
  voucherCode?: string;

  @ApiProperty({ required: false, type: 'object', additionalProperties: true })
  @Column({ type: 'jsonb', nullable: true })
  invoice?: InvoiceSnapshot;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @ApiProperty({ required: false })
  @Column({ name: 'placed_at', type: 'timestamptz', nullable: true })
  placedAt?: Date;

  @OneToMany(() => OrderItem, (item) => item.order, {
    cascade: true,
    eager: true,
  })
  items: OrderItem[];
}
