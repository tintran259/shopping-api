import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { PERMISSION_GROUPS } from '../../../common/permissions';
import { CreateRoleDto, UpdateRoleDto } from '../dto/role.dto';
import { RolesService } from '../services/roles.service';

/** Quản lý vai trò (StaffRole) — chỉ Super Admin (`roles.manage`). */
@ApiTags('admin-roles')
@ApiBearerAuth()
@Controller('admin/roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get('permissions')
  @RequirePermission('roles.manage')
  @ApiOperation({ summary: 'Catalog quyền gán được (cho UI checkbox)' })
  permissions() {
    return PERMISSION_GROUPS;
  }

  @Get()
  @RequirePermission('roles.manage')
  @ApiOperation({ summary: 'Danh sách vai trò' })
  findAll() {
    return this.roles.findAll();
  }

  @Get(':id')
  @RequirePermission('roles.manage')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.findOne(id);
  }

  @Post()
  @RequirePermission('roles.manage')
  @ApiOperation({ summary: 'Tạo vai trò' })
  create(@Body() dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @Patch(':id')
  @RequirePermission('roles.manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('roles.manage')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.remove(id);
  }
}
