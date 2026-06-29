import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Customer } from './customer.entity';

@Entity('b2b_profiles')
export class B2bProfile extends BaseEntity {
  @OneToOne(() => Customer, (c) => c.b2bProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'customer_id', unique: true })
  customerId: string;

  @ApiProperty()
  @Column({ name: 'company_name' })
  companyName: string;

  @ApiProperty()
  @Column({ name: 'tax_code' })
  taxCode: string;

  @ApiProperty({ required: false })
  @Column({ name: 'company_address', nullable: true })
  companyAddress?: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @Column({ name: 'price_tier_id', type: 'uuid', nullable: true })
  priceTierId?: string;

  @ApiProperty({ default: 0 })
  @Column({
    name: 'credit_limit',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  creditLimit: string;

  @ApiProperty({ required: false, description: 'e.g. NET30' })
  @Column({ name: 'payment_terms', nullable: true })
  paymentTerms?: string;
}
