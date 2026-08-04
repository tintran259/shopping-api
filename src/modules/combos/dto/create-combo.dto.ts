import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { ComboStatus } from '../../../common/enums';

export class ComboItemInputDto {
  @ApiProperty({ format: 'uuid', description: 'Biến thể thành phần' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ minimum: 1, description: 'Số lượng trong một combo' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateComboDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiPropertyOptional({ description: 'Bỏ trống = tự sinh từ tên' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ description: 'Giá bán cố định của cả combo (vd "250000.00")' })
  @IsNumberString()
  price: string;

  @ApiPropertyOptional({ enum: ComboStatus })
  @IsOptional()
  @IsEnum(ComboStatus)
  status?: ComboStatus;

  @ApiPropertyOptional({ description: 'ISO datetime — bắt đầu hiệu lực' })
  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'ISO datetime — kết thúc hiệu lực' })
  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @ApiProperty({ type: [ComboItemInputDto], description: 'Thành phần (≥1)' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ComboItemInputDto)
  items: ComboItemInputDto[];
}
