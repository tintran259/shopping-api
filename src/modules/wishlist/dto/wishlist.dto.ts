import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateWishlistDto {
  @ApiProperty() @IsString() name: string;
}

export class UpdateWishlistDto {
  @ApiProperty() @IsString() name: string;
}

export class AddWishlistItemDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productId: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  variantId?: string;
  @ApiProperty({ format: 'uuid', description: 'Target list (required)' })
  @IsUUID()
  wishlistId: string;
}
