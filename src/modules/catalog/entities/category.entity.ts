import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Product } from './product.entity';

@Entity('categories')
export class Category extends BaseEntity {
  @ApiProperty()
  @Column()
  name: string;

  @ApiProperty()
  @Index({ unique: true })
  @Column()
  slug: string;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty({ required: false })
  @Column({ name: 'image_url', nullable: true })
  imageUrl?: string;

  @ApiProperty({ default: 0 })
  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @ApiProperty({ default: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiProperty({ required: false, type: 'object', additionalProperties: true })
  @Column({ type: 'jsonb', nullable: true })
  seo?: { metaTitle?: string; metaDescription?: string };

  /** Tree capped at 3 levels (root → child → grandchild) — enforced in
   *  `CategoriesService`, not the schema. A grandchild is always a leaf
   *  (never gets its own children); products attach to whichever node in a
   *  branch has no children, root included if that branch was never split. */
  @ManyToOne(() => Category, (c) => c.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent?: Category;

  @Column({ name: 'parent_id', nullable: true })
  parentId?: string;

  @OneToMany(() => Category, (c) => c.parent)
  children: Category[];

  /** Inverse side of `Product.categories` — not the join owner, just gives
   *  `CategoriesRepository` a relation to count against for the admin list's
   *  per-category product count. */
  @ManyToMany(() => Product, (p) => p.categories)
  products?: Product[];
}
