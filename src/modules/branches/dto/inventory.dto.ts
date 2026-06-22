import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { InventoryStatus } from '../../../common/enums';

export class UpsertInventoryDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() branchId: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() variantId: string;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) quantity: number;
  @ApiPropertyOptional({ enum: InventoryStatus })
  @IsOptional() @IsEnum(InventoryStatus) status?: InventoryStatus;
}
