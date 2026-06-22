import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateAddressDto {
  @ApiProperty()
  @IsString()
  recipientName: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty({ description: 'Province code (from /locations/provinces)' })
  @Type(() => Number)
  @IsInt()
  provinceCode: number;

  @ApiProperty({ description: 'Ward code (from /locations/provinces/:code/wards)' })
  @Type(() => Number)
  @IsInt()
  wardCode: number;

  @ApiProperty({ description: 'Street / house number' })
  @IsString()
  street: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
