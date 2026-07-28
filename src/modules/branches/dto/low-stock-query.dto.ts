import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Bộ lọc cho endpoint "tồn kho thấp". `threshold = 0` ⇒ các mặt hàng đã hết. */
export class LowStockQueryDto {
  @ApiPropertyOptional({
    default: 0,
    minimum: 0,
    description: 'Ngưỡng available (quantity − reserved) ≤ ngưỡng',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  threshold?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Lọc theo chi nhánh' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
