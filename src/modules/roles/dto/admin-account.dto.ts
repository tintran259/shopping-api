import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { CustomerStatus } from '../../../common/enums';

export class CreateAdminDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) password: string;
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;

  @ApiProperty({ format: 'uuid', description: 'StaffRole gán cho admin này.' })
  @IsUUID()
  staffRoleId: string;
}

export class UpdateAdminDto {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Đổi StaffRole.' })
  @IsOptional()
  @IsUUID()
  staffRoleId?: string;

  @ApiPropertyOptional({
    enum: CustomerStatus,
    description: 'active = mở khoá, disabled = khoá tài khoản.',
  })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional({
    minLength: 8,
    description: 'Đặt lại mật khẩu (tuỳ chọn).',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
