import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CustomerStatus, CustomerType } from '../../../common/enums';

/** Columns the admin customer list may be sorted by (allowlist — prevents SQL injection). */
export const ADMIN_CUSTOMER_SORT_FIELDS = [
  'createdAt',
  'email',
  'lastName',
] as const;
export type AdminCustomerSortField = (typeof ADMIN_CUSTOMER_SORT_FIELDS)[number];

export class AdminCustomerQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CustomerType })
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional({ enum: ADMIN_CUSTOMER_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(ADMIN_CUSTOMER_SORT_FIELDS as unknown as string[])
  sortBy?: AdminCustomerSortField;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
