import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Storefront product-reviews pagination (page ≥ 1, limit 1–50, default 10). */
export class ProductReviewsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;

  /** Filter by star rating (1–5). Omit to return all stars. */
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  star?: number;
}

/** [admin] Phản hồi công khai của shop cho một đánh giá. */
export class ReplyReviewDto {
  @ApiProperty({ description: 'Nội dung phản hồi. Chuỗi rỗng = xóa phản hồi.' })
  @IsString()
  @MaxLength(2000)
  reply: string;
}

export class CreateReviewDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @ApiPropertyOptional({ type: [String], description: 'Absolute URLs from POST /uploads/review-images' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}

/** Per-item review payload inside {@link SubmitOrderReviewDto}. */
export class SubmitItemReviewDto {
  @ApiProperty({ format: 'uuid', description: 'variant_id of the order item being reviewed' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @ApiPropertyOptional({ type: [String], description: 'Absolute URLs from POST /uploads/review-images' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}

/** Storefront "review my delivered order" — one entry per order item.
 *  The FE submits the variant id it received in the order items list so the BE
 *  can resolve the matching product and create one Review entity per item. */
export class SubmitOrderReviewDto {
  @ApiProperty({ type: [SubmitItemReviewDto], description: 'Per-item reviews (at least one required)' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitItemReviewDto)
  items: SubmitItemReviewDto[];
}
