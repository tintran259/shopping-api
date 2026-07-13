import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** What the admin can optionally add when explicitly creating a GHN shipping
 *  order — unlike GHTK, GHN needs no admin-supplied address data (its
 *  district/ward are resolved automatically via `GhnAddressResolver`), so
 *  this is deliberately tiny: just GHN's own "note to shipper" field. */
export class CreateGhnShipmentDto {
  @ApiPropertyOptional({
    description: 'Ghi chú cho shipper (GHN\'s "note" field)',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;
}
