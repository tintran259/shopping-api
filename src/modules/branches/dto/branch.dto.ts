import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateBranchDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() provinceCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({
    description:
      'GHN "shop id" this branch ships from (configured in GHN\'s own dashboard)',
  })
  @IsOptional()
  @IsString()
  ghnShopId?: string;

  @ApiPropertyOptional({
    description:
      'District (quận/huyện) this branch ships from, for GHTK pickup',
  })
  @IsOptional()
  @IsString()
  ghtkPickupDistrict?: string;

  @ApiPropertyOptional({
    description: 'Ward (phường/xã) this branch ships from, for GHTK pickup',
  })
  @IsOptional()
  @IsString()
  ghtkPickupWard?: string;
}

export class UpdateBranchDto extends PartialType(CreateBranchDto) {}
