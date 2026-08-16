import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ComboStatus } from '../../../common/enums';
import { Branch } from '../../branches/entities/branch.entity';
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
  startsAt?: Date | null;

  @ApiProperty({ required: false })
  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt?: Date | null;

  /** Chi nhánh bán/tính tồn của combo. `null` = mọi chi nhánh (tổng tồn toàn hệ
   *  thống). Khi có, tồn khả dụng chỉ tính trên chi nhánh này — khớp với việc
   *  mỗi đơn giữ kho theo đúng 1 chi nhánh. */
  @ApiProperty({ required: false, format: 'uuid' })
  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId?: string | null;

  @ManyToOne(() => Branch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branch_id' })
  branch?: Branch | null;

  /** Chỉ cascade khi TẠO combo. Lúc update, thành phần được thay tường minh
   *  (xóa dòng cũ + chèn dòng mới) trong `CombosService.update` — không dựa vào
   *  orphan-removal của TypeORM (nó nullify combo_id → vi phạm NOT NULL). */
  @OneToMany(() => ComboItem, (i) => i.combo, { cascade: true })
  items: ComboItem[];
}
