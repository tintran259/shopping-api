import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ProductVariant } from '../../catalog/entities/product-variant.entity';
import { Combo } from './combo.entity';

/** Một thành phần của combo: (biến thể × số lượng). Tham chiếu variant "sống"
 *  (giá/tồn/tên lấy tại thời điểm bán), không denormalise. */
@Entity('combo_items')
export class ComboItem extends BaseEntity {
  @ManyToOne(() => Combo, (c) => c.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'combo_id' })
  combo: Combo;

  @Column({ name: 'combo_id' })
  comboId: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'variant_id' })
  variantId: string;

  @ApiProperty({ description: 'Số lượng biến thể này trong một combo' })
  @Column({ type: 'int' })
  quantity: number;
}
