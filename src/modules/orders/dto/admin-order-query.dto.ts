import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { OrderStatus, PaymentStatus } from '../../../common/enums';

/** Columns the admin order list may be sorted by (allowlist — prevents SQL injection). */
export const ORDER_SORT_FIELDS = [
  'createdAt',
  'placedAt',
  'grandTotal',
  'status',
  'code',
] as const;
export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];

export class AdminOrderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter by fulfilling branch (omit = all branches)',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ enum: ORDER_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(ORDER_SORT_FIELDS as unknown as string[])
  sortBy?: OrderSortField;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
