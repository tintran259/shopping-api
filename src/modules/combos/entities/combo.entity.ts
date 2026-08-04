import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ComboStatus } from '../../../common/enums';
import { ComboItem } from './combo-item.entity';

/**
 * Combo sản phẩm: gói nhiều biến thể bán kèm ở một **giá cố định** (`price`).
 * Kho combo là ẢO — không có tồn riêng, mà suy từ tồn các thành phần (xem
 * `CombosService.computeAvailability`). Khi bán, combo "nở" thành các order-item
 * thành phần với giá combo phân bổ về từng dòng.
 */
@Entity('combos')
export class Combo extends BaseEntity {
  @ApiProperty()
  @Index({ unique: true })
  @Column()
  slug: string;

  @ApiProperty()
  @Column()
  name: string;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty({ required: false })
  @Column({ name: 'image_url', nullable: true })
  imageUrl?: string;

  @ApiProperty({ description: 'Giá bán cố định của cả combo' })
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: string;

  @ApiProperty({ enum: ComboStatus })
  @Column({ type: 'enum', enum: ComboStatus, default: ComboStatus.DRAFT })
  status: ComboStatus;

  @ApiProperty({ required: false })
  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt?: Date;

  @ApiProperty({ required: false })
  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt?: Date;

  @OneToMany(() => ComboItem, (i) => i.combo, { cascade: true })
  items: ComboItem[];
}
