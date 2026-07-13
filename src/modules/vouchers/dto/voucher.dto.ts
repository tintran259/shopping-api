import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  ShippingMethodCode,
  VoucherCustomerScope,
  VoucherType,
} from '../../../common/enums';

export class CreateVoucherDto {
  @ApiProperty({ example: 'WELCOME15' }) @IsString() code: string;
  @ApiProperty({ enum: VoucherType }) @IsEnum(VoucherType) type: VoucherType;
  @ApiProperty({
    example: '15',
    description:
      'percent: %; fixed: đ off subtotal; shipping: đ off shipping fee, or "0" = free shipping toàn bộ (100%)',
  })
  @IsNumberString()
  value: string;
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
    description:
      'Product ids this voucher is restricted to ("combo") — empty/omitted = every product',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Branch ids this voucher is restricted to — empty/omitted = every branch',
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

  @ApiPropertyOptional({
    enum: ShippingMethodCode,
    isArray: true,
    description:
      'Only for shipping vouchers: home-delivery methods it applies to (standard/express). Empty/omitted = every method.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ShippingMethodCode, { each: true })
  shippingMethods?: ShippingMethodCode[];
}

export class UpdateVoucherDto extends PartialType(CreateVoucherDto) {}

export class CheckVoucherDto {
  @ApiProperty({ example: 'WELCOME15' })
  @IsString()
  code: string;

  @ApiProperty({ example: 500000, description: 'Cart subtotal in VND' })
  @IsNumber()
  subtotal: number;

  @ApiPropertyOptional({ example: 30000, default: 0 })
  @IsOptional()
  @IsNumber()
  shippingFee?: number;

  @ApiPropertyOptional({
    description: 'Selected branch id for branch-scoped vouchers',
  })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({
    enum: ShippingMethodCode,
    description:
      'Chosen home-delivery method (standard/express) — required for a shipping voucher restricted to specific methods',
  })
  @IsOptional()
  @IsEnum(ShippingMethodCode)
  shippingMethod?: ShippingMethodCode;

  @ApiPropertyOptional({
    description: 'Logged-in customer id for customer-scoped vouchers',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Product slugs currently in the cart',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productSlugs?: string[];
}
