import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { InventoryStatus } from '../../../common/enums';
import { ProductVariant } from '../../catalog/entities/product-variant.entity';
import { Branch } from './branch.entity';

@Entity('inventory')
@Index(['branchId', 'variantId'], { unique: true })
export class Inventory extends BaseEntity {
  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id' })
  branchId: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Column({ name: 'variant_id' })
  variantId: string;

  @ApiProperty({ default: 0 })
  @Column({ type: 'int', default: 0 })
  quantity: number;

  @ApiProperty({ enum: InventoryStatus })
  @Column({ type: 'enum', enum: InventoryStatus, default: InventoryStatus.IN_STOCK })
  status: InventoryStatus;
}
