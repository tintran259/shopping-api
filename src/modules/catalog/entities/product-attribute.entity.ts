import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Product } from './product.entity';

@Entity('product_attributes')
export class ProductAttribute extends BaseEntity {
  @ManyToOne(() => Product, (p) => p.attributes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'product_id' })
  productId: string;

  @ApiProperty({ example: 'material' })
  @Column()
  key: string;

  @ApiProperty({ example: 'Chất liệu' })
  @Column()
  label: string;

  @ApiProperty({ description: 'string | string[]' })
  @Column({ type: 'jsonb' })
  value: string | string[];

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  group?: string;
}
