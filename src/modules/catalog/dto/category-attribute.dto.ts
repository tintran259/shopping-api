import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CategoryAttributeType } from '../../../common/enums';

export class CreateCategoryAttributeDto {
  @ApiProperty({ example: 'Size' })
  @IsString()
  name: string;

  @ApiProperty({ enum: CategoryAttributeType })
  @IsEnum(CategoryAttributeType)
  type: CategoryAttributeType;

  @ApiPropertyOptional({
    type: [String],
    description: 'Required for SELECT/MULTISELECT',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCategoryAttributeDto extends PartialType(
  CreateCategoryAttributeDto,
) {}
