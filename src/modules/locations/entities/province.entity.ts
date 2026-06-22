import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Ward } from './ward.entity';

/**
 * VN province / centrally-governed city (2025 2-tier model — 34 provinces).
 * Uses the administrative `code` as the natural primary key, sourced from
 * provinces.open-api.vn v2. See LocationsService.syncFromOpenApi.
 */
@Entity('provinces')
export class Province {
  @ApiProperty({ example: 1, description: 'Administrative code (natural key)' })
  @PrimaryColumn({ type: 'int' })
  code: number;

  @ApiProperty({ example: 'Thành phố Hà Nội' })
  @Column()
  name: string;

  @ApiProperty({ example: 'thành phố trung ương' })
  @Column({ name: 'division_type', nullable: true })
  divisionType?: string;

  @ApiProperty({ example: 'ha_noi' })
  @Column({ nullable: true })
  codename?: string;

  @ApiProperty({ example: 24, required: false })
  @Column({ name: 'phone_code', type: 'int', nullable: true })
  phoneCode?: number;

  @OneToMany(() => Ward, (w) => w.province)
  wards: Ward[];
}
