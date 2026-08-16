import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Lọc danh sách combo công khai (storefront): phân trang + theo chi nhánh. */
export class PublicComboQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Chỉ lấy combo bán tại chi nhánh này — bao gồm cả combo áp dụng mọi ' +
      'chi nhánh (branchId null). Bỏ trống = lấy tất cả combo đang bán.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
