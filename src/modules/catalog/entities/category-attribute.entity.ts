import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { CategoryAttributeType } from '../../../common/enums';
import { Category } from './category.entity';

/** A filter *definition* for a (leaf) category — e.g. "Size" is a SELECT with
 *  options S/M/L. This is a template only: it does not itself hold any
 *  product's value (that stays in `ProductAttribute`, unchanged and
 *  unrelated) — see the enum doc comment for why the two are kept separate. */
@Entity('category_attributes')
export class CategoryAttribute extends BaseEntity {
  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ name: 'category_id' })
  categoryId: string;

  @ApiProperty({ example: 'Size' })
  @Column()
  name: string;

  @ApiProperty({ enum: CategoryAttributeType })
  @Column({ type: 'enum', enum: CategoryAttributeType })
  type: CategoryAttributeType;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'SELECT/MULTISELECT only',
  })
  @Column({ type: 'jsonb', nullable: true })
  options?: string[];

  @ApiProperty({ default: false })
  @Column({ name: 'is_required', default: false })
  isRequired: boolean;

  @ApiProperty({ default: 0 })
  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;
}
