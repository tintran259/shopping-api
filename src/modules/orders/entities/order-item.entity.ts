import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Order } from './order.entity';

/**
 * Line item with denormalised product data — orders must remain accurate even
 * if the underlying product/variant is later edited or deleted.
 */
@Entity('order_items')
export class OrderItem extends BaseEntity {
  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id' })
  orderId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'variant_id' })
  variantId: string;

  @ApiProperty()
  @Column({ name: 'product_name' })
  productName: string;

  @ApiProperty()
  @Column({ name: 'variant_title' })
  variantTitle: string;

  @ApiProperty()
  @Column()
  sku: string;

  @ApiProperty()
  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2 })
  unitPrice: string;

  @ApiProperty()
  @Column({ type: 'int' })
  quantity: number;

  @ApiProperty()
  @Column({ name: 'line_total', type: 'numeric', precision: 12, scale: 2 })
  lineTotal: string;
}
