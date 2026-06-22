import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { OptionDisplayType, ProductStatus } from '../../../common/enums';

export class ProductImageInput {
  @ApiProperty() @IsString() url: string;
  @ApiPropertyOptional() @IsOptional() @IsString() alt?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class ProductAttributeInput {
  @ApiProperty() @IsString() key: string;
  @ApiProperty() @IsString() label: string;
  @ApiProperty() value: string | string[];
  @ApiPropertyOptional() @IsOptional() @IsString() group?: string;
}

export class ProductOptionInput {
  @ApiProperty({ example: 'Màu' }) @IsString() name: string;
  @ApiProperty({ enum: OptionDisplayType }) @IsEnum(OptionDisplayType) displayType: OptionDisplayType;
  @ApiProperty({ type: [String], example: ['Đen', 'Trắng'] })
  @IsArray() @IsString({ each: true }) values: string[];
}

export class VariantInput {
  @ApiProperty() @IsString() sku: string;
  @ApiProperty({ example: '199000.00' }) @IsNumberString() price: string;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() compareAtPrice?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Selected value per option name, e.g. { "Màu": "Đen", "Size": "M" }',
  })
  @IsOptional()
  @IsObject()
  optionValues?: Record<string, string>;
}

export class CreateProductDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() slug: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shortDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ enum: ProductStatus }) @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() brandId?: string;
  @ApiProperty({ example: '199000.00' }) @IsNumberString() basePrice: string;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() compareAtPrice?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) categoryIds?: string[];

  @ApiPropertyOptional({ type: [ProductImageInput] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductImageInput)
  images?: ProductImageInput[];

  @ApiPropertyOptional({ type: [ProductAttributeInput] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductAttributeInput)
  attributes?: ProductAttributeInput[];

  @ApiPropertyOptional({ type: [ProductOptionInput] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductOptionInput)
  options?: ProductOptionInput[];

  @ApiPropertyOptional({ type: [VariantInput] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VariantInput)
  variants?: VariantInput[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by category slug' })
  @IsOptional() @IsString() category?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Sort, e.g. "createdAt:DESC" | "basePrice:ASC"' })
  @IsOptional() @IsString() sort?: string;
}
