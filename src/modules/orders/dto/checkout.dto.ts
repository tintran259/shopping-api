import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
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

  @ApiPropertyOptional({
    description:
      'Client-preset order code (e.g. bank-transfer memo). Falls back to a generated one.',
  })
  @IsOptional()
  @IsString()
  code?: string;
}

export class CheckoutItemDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() variantId: string;
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

/** Guest checkout: same as {@link CheckoutDto} but items come from the body
 *  (no server cart). Prices/stock are still recomputed server-side. */
export class GuestCheckoutDto extends CheckoutDto {
  @ApiProperty({ type: [CheckoutItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];
}

/** Staff-entered order (phone order, walk-in, B2B deal closed offline…). Same
 *  shape as {@link GuestCheckoutDto} today, but kept as its own type — this is
 *  an authenticated admin action on behalf of a customer, not an anonymous
 *  storefront checkout, and the two should be free to diverge (e.g. admin
 *  gaining a `customerId` to attribute the order once the admin customer list
 *  ships) without touching the public guest-checkout path. */
export class AdminCreateOrderDto extends GuestCheckoutDto {}
