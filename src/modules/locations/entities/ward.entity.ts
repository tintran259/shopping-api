import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Province } from './province.entity';

/** VN ward / commune (2025 2-tier model — child of a province, no district). */
@Entity('wards')
export class Ward {
  @ApiProperty({ example: 4, description: 'Administrative code (natural key)' })
  @PrimaryColumn({ type: 'int' })
  code: number;

  @ApiProperty({ example: 'Phường Ba Đình' })
  @Column()
  name: string;

  @ApiProperty({ example: 'phường' })
  @Column({ name: 'division_type', nullable: true })
  divisionType?: string;

  @ApiProperty({ example: 'phuong_ba_dinh' })
  @Column({ nullable: true })
  codename?: string;

  @ManyToOne(() => Province, (p) => p.wards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'province_code' })
  province: Province;

  @ApiProperty({ example: 1 })
  @Index()
  @Column({ name: 'province_code', type: 'int' })
  provinceCode: number;
}
