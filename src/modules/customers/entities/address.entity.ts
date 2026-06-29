import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Customer } from './customer.entity';

/**
 * Customer address book entry. Uses the 2025 2-tier model (province → ward, no
 * district). `provinceCode`/`wardCode` reference the locations tables; the
 * `*Name` fields are denormalised from there at write time for display/snapshots.
 */
@Entity('addresses')
export class Address extends BaseEntity {
  @ManyToOne(() => Customer, (c) => c.addresses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'customer_id' })
  customerId: string;

  @ApiPropertyOptional({ description: 'Optional label, e.g. "Nhà riêng"' })
  @Column({ type: 'varchar', nullable: true })
  label?: string;

  @ApiProperty()
  @Column({ name: 'recipient_name' })
  recipientName: string;

  @ApiProperty()
  @Column()
  phone: string;

  @ApiProperty({ description: 'Province administrative code' })
  @Column({ name: 'province_code', type: 'int' })
  provinceCode: number;

  @ApiProperty()
  @Column({ name: 'province_name' })
  provinceName: string;

  @ApiProperty({ description: 'Ward administrative code' })
  @Column({ name: 'ward_code', type: 'int' })
  wardCode: number;

  @ApiProperty()
  @Column({ name: 'ward_name' })
  wardName: string;

  @ApiProperty({ description: 'Street / house number' })
  @Column()
  street: string;

  @ApiProperty({ default: false })
  @Column({ name: 'is_default', default: false })
  isDefault: boolean;
}
