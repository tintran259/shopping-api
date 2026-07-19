import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ReviewStatus } from '../../../common/enums';

export class AdminReviewQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Lọc theo số sao' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}

/** Thống kê nhanh cho các thẻ tổng quan ở trang duyệt đánh giá. */
export interface ReviewStats {
  pending: number;
  published: number;
  rejected: number;
  total: number;
  /** Điểm trung bình (0 nếu chưa có đánh giá). */
  average: number;
}
