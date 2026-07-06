import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { VoucherCustomerScope, VoucherType } from '../../../common/enums';

export class CreateVoucherDto {
  @ApiProperty({ example: 'WELCOME15' }) @IsString() code: string;
  @ApiProperty({ enum: VoucherType }) @IsEnum(VoucherType) type: VoucherType;
  @ApiProperty({ example: '15' }) @IsNumberString() value: string;
  @ApiPropertyOptional({ default: '0' })
  @IsOptional()
  @IsNumberString()
  minSubtotal?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() maxDiscount?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() usageLimit?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() perCustomerLimit?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endsAt?: string;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Product ids this voucher is restricted to ("combo") — empty/omitted = every product',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Branch ids this voucher is restricted to — empty/omitted = every branch',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  branchIds?: string[];

  @ApiPropertyOptional({
    enum: VoucherCustomerScope,
    default: VoucherCustomerScope.SPECIFIC,
    description:
      'specific (uses customerIds, empty = unrestricted) | guests (no account on the order) | users (any account)',
  })
  @IsOptional()
  @IsEnum(VoucherCustomerScope)
  customerScope?: VoucherCustomerScope;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Customer ids this voucher is restricted to — only used when customerScope is "specific"; empty/omitted there = every customer',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  customerIds?: string[];
}

export class UpdateVoucherDto extends PartialType(CreateVoucherDto) {}
