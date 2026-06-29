import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';
import { VoucherType } from '../../../common/enums';

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
}

export class UpdateVoucherDto extends PartialType(CreateVoucherDto) {}
