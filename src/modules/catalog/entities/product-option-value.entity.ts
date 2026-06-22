import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ProductOption } from './product-option.entity';

@Entity('product_option_values')
export class ProductOptionValue extends BaseEntity {
  @ManyToOne(() => ProductOption, (o) => o.values, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'option_id' })
  option: ProductOption;

  @Column({ name: 'option_id' })
  optionId: string;

  @ApiProperty({ example: 'Đen' })
  @Column()
  value: string;

  @ApiProperty({ default: 0 })
  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;
}
