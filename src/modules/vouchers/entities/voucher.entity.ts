import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { VoucherCustomerScope, VoucherType } from '../../../common/enums';
import { Branch } from '../../branches/entities/branch.entity';
import { Product } from '../../catalog/entities/product.entity';
import { Customer } from '../../customers/entities/customer.entity';

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

  /** Empty = no restriction (applies to every product/branch/customer) — a
   *  voucher only narrows once rows exist here, see `VouchersService.evaluate`.
   *  "Group" is just "more than one row" — there's no separate reusable
   *  group entity, the admin picks the exact set per voucher. */
  @ApiProperty({ type: () => [Product], required: false })
  @ManyToMany(() => Product)
  @JoinTable({
    name: 'voucher_products',
    joinColumn: { name: 'voucher_id' },
    inverseJoinColumn: { name: 'product_id' },
  })
  products?: Product[];

  @ApiProperty({ type: () => [Branch], required: false })
  @ManyToMany(() => Branch)
  @JoinTable({
    name: 'voucher_branches',
    joinColumn: { name: 'voucher_id' },
    inverseJoinColumn: { name: 'branch_id' },
  })
  branches?: Branch[];

  /** SPECIFIC + empty `customers` = unrestricted (today's default: anyone,
   *  guest or account). SPECIFIC + non-empty = only those accounts.
   *  GUESTS/USERS ignore `customers` and gate purely on whether the order
   *  has a customerId — see `VouchersService.evaluate`. */
  @ApiProperty({ enum: VoucherCustomerScope, default: VoucherCustomerScope.SPECIFIC })
  @Column({
    name: 'customer_scope',
    type: 'enum',
    enum: VoucherCustomerScope,
    default: VoucherCustomerScope.SPECIFIC,
  })
  customerScope: VoucherCustomerScope;

  @ApiProperty({ type: () => [Customer], required: false })
  @ManyToMany(() => Customer)
  @JoinTable({
    name: 'voucher_customers',
    joinColumn: { name: 'voucher_id' },
    inverseJoinColumn: { name: 'customer_id' },
  })
  customers?: Customer[];
}
