import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * What the admin fills in to create a real GHTK shipping order for a
 * delivery order (`POST /admin/orders/:id/shipment/ghtk`). Everything GHTK
 * needs is derived server-side from the order/branch — recipient name/phone/
 * street/ward/province from `order.shippingAddress`, pickup name/address/
 * phone/ward/district from the branch — except the destination's district
 * (quận/huyện), which our own location data doesn't model (2025 reform:
 * province → ward only) and varies per order, so there's no way to derive
 * it; the admin must type the real one in.
 */
export class CreateGhtkShipmentDto {
  @ApiProperty({
    example: 'Quận 1',
    description:
      'District (quận/huyện) of the delivery address — GHTK requires it, our own location data no longer stores it',
  })
  @IsString()
  district: string;

  @ApiPropertyOptional({
    description:
      'Declared value for insurance/claims — defaults to the order grand total',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Shop pays the shipping fee',
  })
  @IsOptional()
  @IsBoolean()
  isFreeship?: boolean;
}
