import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('branches')
export class Branch extends BaseEntity {
  @ApiProperty()
  @Column()
  name: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  address?: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  city?: string;

  @ApiProperty({ required: false, description: 'VN province code' })
  @Column({ name: 'province_code', nullable: true })
  provinceCode?: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  phone?: string;

  @ApiProperty({ default: false })
  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @ApiProperty({ default: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
