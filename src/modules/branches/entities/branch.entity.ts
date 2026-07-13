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

  @ApiProperty({
    required: false,
    description:
      'GHN "shop id" this branch ships from — the pickup address itself ' +
      "is configured once in GHN's own merchant dashboard against this id, not here.",
  })
  @Column({ name: 'ghn_shop_id', nullable: true })
  ghnShopId?: string;

  @ApiProperty({
    required: false,
    description:
      'District (quận/huyện) this branch ships from — GHTK requires it on ' +
      "the pickup address but our own location data doesn't model that level " +
      '(2025 admin reform: province → ward only), so it is configured once here.',
  })
  @Column({ name: 'ghtk_pickup_district', nullable: true })
  ghtkPickupDistrict?: string;

  @ApiProperty({
    required: false,
    description: 'Ward (phường/xã) this branch ships from, for GHTK pickup.',
  })
  @Column({ name: 'ghtk_pickup_ward', nullable: true })
  ghtkPickupWard?: string;

  @ApiProperty({ default: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
