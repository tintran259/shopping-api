import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { OptionDisplayType } from '../../../common/enums';
import { ProductOptionValue } from './product-option-value.entity';
import { Product } from './product.entity';

@Entity('product_options')
export class ProductOption extends BaseEntity {
  @ManyToOne(() => Product, (p) => p.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'product_id' })
  productId: string;

  @ApiProperty({ example: 'Màu' })
  @Column()
  name: string;

  @ApiProperty({ enum: OptionDisplayType })
  @Column({
    name: 'display_type',
    type: 'enum',
    enum: OptionDisplayType,
    default: OptionDisplayType.PILL,
  })
  displayType: OptionDisplayType;

  @ApiProperty({ default: 0 })
  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @OneToMany(() => ProductOptionValue, (v) => v.option, { cascade: true })
  values: ProductOptionValue[];
}
