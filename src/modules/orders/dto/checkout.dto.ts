import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { FulfillmentType, PaymentMethodCode } from '../../../common/enums';

export class ShippingAddressDto {
  @ApiProperty() @IsString() recipientName: string;
  @ApiProperty() @IsString() phone: string;
  @ApiProperty({ description: 'Province code' })
  @Type(() => Number)
  @IsInt()
  provinceCode: number;
  @ApiProperty({ description: 'Ward code' })
  @Type(() => Number)
  @IsInt()
  wardCode: number;
  @ApiProperty() @IsString() street: string;
}

export class InvoiceDto {
  @ApiProperty() @IsString() companyName: string;
  @ApiProperty() @IsString() taxCode: string;
  @ApiProperty() @IsString() address: string;
  @ApiProperty() @IsEmail() email: string;
}

export class CheckoutDto {
  @ApiProperty({ format: 'uuid', description: 'Fulfilling branch' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ enum: FulfillmentType })
  @IsEnum(FulfillmentType)
  fulfillment: FulfillmentType;

  @ApiProperty({ enum: PaymentMethodCode })
  @IsEnum(PaymentMethodCode)
  paymentMethodCode: PaymentMethodCode;

  @ApiProperty() @IsString() recipientName: string;
  @ApiProperty() @IsString() recipientPhone: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() recipientEmail?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Use a saved address (delivery)',
  })
  @IsOptional()
  @IsUUID()
  shippingAddressId?: string;

  @ApiPropertyOptional({ type: ShippingAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;

  @ApiPropertyOptional({ description: 'Voucher code to apply' })
  @IsOptional()
  @IsString()
  voucherCode?: string;

  @ApiPropertyOptional({ default: '0.00' })
  @IsOptional()
  @IsNumberString()
  shippingFee?: string;

  @ApiPropertyOptional({ type: InvoiceDto, description: 'VAT invoice (B2B)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceDto)
  invoice?: InvoiceDto;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
