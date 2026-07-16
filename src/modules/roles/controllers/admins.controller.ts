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
import { CreateAdminDto, UpdateAdminDto } from '../dto/admin-account.dto';
import { AdminsService } from '../services/admins.service';

/** Quản lý tài khoản admin — chỉ Super Admin (`admins.manage`). */
@ApiTags('admin-accounts')
@ApiBearerAuth()
@Controller('admin/admins')
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  @RequirePermission('admins.manage')
  @ApiOperation({ summary: 'Danh sách tài khoản admin' })
  findAll() {
    return this.admins.findAll();
  }

  @Post()
  @RequirePermission('admins.manage')
  @ApiOperation({ summary: 'Tạo tài khoản admin + gán vai trò' })
  create(@Body() dto: CreateAdminDto) {
    return this.admins.create(dto);
  }

  @Patch(':id')
  @RequirePermission('admins.manage')
  @ApiOperation({ summary: 'Sửa vai trò / khoá / đổi mật khẩu admin' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAdminDto) {
    return this.admins.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('admins.manage')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.admins.remove(id);
  }
}
