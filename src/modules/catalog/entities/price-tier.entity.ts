import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { PriceListItem } from './price-list-item.entity';

@Entity('price_tiers')
export class PriceTier extends BaseEntity {
  @ApiProperty({ example: 'Wholesale' })
  @Column()
  name: string;

  @OneToMany(() => PriceListItem, (i) => i.priceTier)
  items: PriceListItem[];
}
