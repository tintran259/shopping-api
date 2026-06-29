import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  CustomerRole,
  CustomerStatus,
  CustomerType,
} from '../../../common/enums';
import { Address } from './address.entity';
import { B2bProfile } from './b2b-profile.entity';

@Entity('customers')
export class Customer extends BaseEntity {
  @ApiProperty({ required: false, description: 'null for guest-only contacts' })
  @Index({ unique: true, where: '"email" IS NOT NULL' })
  @Column({ nullable: true })
  email?: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  phone?: string;

  @ApiHideProperty()
  @Column({ name: 'password_hash', nullable: true, select: false })
  passwordHash?: string;

  @ApiProperty({ enum: CustomerType })
  @Column({
    type: 'enum',
    enum: CustomerType,
    default: CustomerType.INDIVIDUAL,
  })
  type: CustomerType;

  @ApiProperty({ enum: CustomerRole })
  @Column({ type: 'enum', enum: CustomerRole, default: CustomerRole.CUSTOMER })
  role: CustomerRole;

  @ApiProperty({ required: false })
  @Column({ name: 'first_name', nullable: true })
  firstName?: string;

  @ApiProperty({ required: false })
  @Column({ name: 'last_name', nullable: true })
  lastName?: string;

  @ApiProperty({ enum: CustomerStatus })
  @Column({
    type: 'enum',
    enum: CustomerStatus,
    default: CustomerStatus.ACTIVE,
  })
  status: CustomerStatus;

  @ApiProperty({ required: false, format: 'uuid' })
  @Column({ name: 'default_branch_id', type: 'uuid', nullable: true })
  defaultBranchId?: string;

  @OneToMany(() => Address, (address) => address.customer)
  addresses: Address[];

  @OneToOne(() => B2bProfile, (profile) => profile.customer)
  b2bProfile?: B2bProfile;
}
