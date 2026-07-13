import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { ShipmentStatus } from '../../../common/enums';

/** Carrier is free text on purpose (see `Shipment.carrier`) — the FE offers a
 *  preset dropdown of common VN carriers + "Tự giao" (self-delivery) + a
 *  custom "Khác" option, but the BE never validates against a fixed list so
 *  a new courier doesn't need a code change. */
export class UpsertShipmentDto {
  @ApiPropertyOptional({ example: 'GHN' })
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trackingNo?: string;

  @ApiPropertyOptional({ enum: ShipmentStatus })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @ApiPropertyOptional({ default: '0.00' })
  @IsOptional()
  @IsNumberString()
  fee?: string;
}
