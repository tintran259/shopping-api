import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('shipping_methods')
export class ShippingMethod extends BaseEntity {
  @ApiProperty({ example: 'standard', description: 'standard|express|pickup' })
  @Index({ unique: true })
  @Column()
  code: string;

  @ApiProperty()
  @Column()
  label: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  eta?: string;
}
