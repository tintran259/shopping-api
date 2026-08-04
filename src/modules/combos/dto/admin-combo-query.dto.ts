import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ComboStatus } from '../../../common/enums';

/** Lọc danh sách combo phía admin (server-side). */
export class AdminComboQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ComboStatus })
  @IsOptional()
  @IsEnum(ComboStatus)
  status?: ComboStatus;
}
