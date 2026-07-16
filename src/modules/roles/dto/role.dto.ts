import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty() @IsString() name: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiProperty({
    type: [String],
    description:
      'Danh sách quyền <feature>.<view|manage> (xem GET /admin/roles/permissions).',
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions: string[];

  @ApiPropertyOptional({
    description: 'Cho phép mọi chi nhánh (bỏ qua branchIds).',
  })
  @IsOptional()
  @IsBoolean()
  allBranches?: boolean;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  branchIds?: string[];
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
