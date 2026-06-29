import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ minimum: 1, default: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Selected branch (scopes stock)',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class UpdateCartItemDto {
  @ApiProperty({ minimum: 0, description: 'Set to 0 to remove the line' })
  @IsInt()
  @Min(0)
  quantity: number;
}
