import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
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
  @ApiProperty({ enum: OptionDisplayType })
  @IsEnum(OptionDisplayType)
  displayType: OptionDisplayType;
  @ApiProperty({ type: [String], example: ['Đen', 'Trắng'] })
  @IsArray()
  @IsString({ each: true })
  values: string[];
}

export class VariantInput {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Existing variant id (update path only) — omit for a new variant.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty() @IsString() sku: string;
  @ApiProperty({ example: '199000.00' }) @IsNumberString() price: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  compareAtPrice?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    description:
      'Selected value per option name, e.g. { "Màu": "Đen", "Size": "M" }',
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
  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  brandId?: string;
  @ApiProperty({ example: '199000.00' }) @IsNumberString() basePrice: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  compareAtPrice?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ type: [ProductImageInput] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageInput)
  images?: ProductImageInput[];

  @ApiPropertyOptional({ type: [ProductAttributeInput] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeInput)
  attributes?: ProductAttributeInput[];

  @ApiPropertyOptional({ type: [ProductOptionInput] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductOptionInput)
  options?: ProductOptionInput[];

  @ApiPropertyOptional({ type: [VariantInput] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantInput)
  variants?: VariantInput[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by category slug' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({
    description: 'Sort, e.g. "createdAt:DESC" | "basePrice:ASC"',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ description: 'Min price (VND)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Max price (VND)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    type: [String],
    description: 'Brand slug(s); repeatable',
  })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsString({ each: true })
  brand?: string[];

  @ApiPropertyOptional({
    description:
      'Attribute filters, "key:value" comma-separated, e.g. "region:Tây Bắc,cert:OCOP"',
  })
  @IsOptional()
  @IsString()
  attrs?: string;

  @ApiPropertyOptional({
    description: 'Scope to a branch — only products carried there',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

/** Parse the `attrs` query ("key:val,key:val") into { key → values[] }. */
export function parseAttrs(attrs?: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!attrs) return map;
  for (const pair of attrs.split(',')) {
    const i = pair.indexOf(':');
    if (i < 0) continue;
    const key = pair.slice(0, i).trim();
    const val = pair.slice(i + 1).trim();
    if (!key || !val) continue;
    const list = map.get(key) ?? [];
    list.push(val);
    map.set(key, list);
  }
  return map;
}
