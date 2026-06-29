import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SubscribeBackInStockDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() variantId: string;
  @ApiProperty({ description: 'email or phone' }) @IsString() contact: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
