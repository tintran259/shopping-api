import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/** Branch filter for the "orders awaiting approval" reminder count (a current
 *  snapshot — no date range, unlike the dashboard summary). */
export class PendingReviewQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter by fulfilling branch (omit = all allowed branches)',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
