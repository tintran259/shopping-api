import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateWishlistDto {
  @ApiProperty() @IsString() name: string;
}

export class AddWishlistItemDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productId: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() variantId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Target list (defaults to your default list)' })
  @IsOptional() @IsUUID() wishlistId?: string;
}
