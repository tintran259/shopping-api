import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Mirrors the FE's `deriveState()` in `vouchers-page.tsx` — `isActive` +
 *  `startsAt`/`endsAt` don't map to a stored status column, so the list filter
 *  computes the same precedence in SQL (disabled beats scheduled/expired). */
export const VOUCHER_STATE_VALUES = [
  'active',
  'scheduled',
  'expired',
  'disabled',
] as const;
export type VoucherState = (typeof VOUCHER_STATE_VALUES)[number];

export class AdminVoucherQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: VOUCHER_STATE_VALUES })
  @IsOptional()
  @IsIn(VOUCHER_STATE_VALUES as unknown as string[])
  state?: VoucherState;
}

export type VoucherStateCounts = Record<VoucherState, number> & {
  total: number;
};
