import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SubscribeBackInStockDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() variantId: string;
  @ApiProperty({ description: 'email or phone' }) @IsString() contact: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Set when the subscriber has an account' })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
