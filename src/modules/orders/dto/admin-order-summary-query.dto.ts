import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

/** Branch/date-range filters for the aggregate summary endpoint (COUNT/SUM via
 *  SQL — not limited by pagination, unlike the order list). */
export class AdminOrderSummaryQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter by fulfilling branch (omit = all branches)',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Inclusive start (ISO datetime)' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Exclusive end (ISO datetime)' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}
