import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { CartStatus } from '../../../common/enums';
import { CartItem } from './cart-item.entity';

@Entity('carts')
export class Cart extends BaseEntity {
  @ApiProperty({ required: false, format: 'uuid', description: 'null = guest' })
  @Index()
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId?: string;

  @ApiProperty({ required: false })
  @Column({ name: 'session_id', nullable: true })
  sessionId?: string;

  @ApiProperty({ required: false, format: 'uuid', description: 'selected branch (scopes stock)' })
  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId?: string;

  @ApiProperty({ enum: CartStatus })
  @Column({ type: 'enum', enum: CartStatus, default: CartStatus.ACTIVE })
  status: CartStatus;

  @ApiProperty({ default: 'VND' })
  @Column({ default: 'VND' })
  currency: string;

  @OneToMany(() => CartItem, (item) => item.cart, { cascade: true, eager: true })
  items: CartItem[];
}
