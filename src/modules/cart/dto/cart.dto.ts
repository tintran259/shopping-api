import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Biến thể sản phẩm (dùng một trong variantId/comboId)',
  })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Combo (xor variantId) — dòng combo trong giỏ',
  })
  @IsOptional()
  @IsUUID()
  comboId?: string;

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
