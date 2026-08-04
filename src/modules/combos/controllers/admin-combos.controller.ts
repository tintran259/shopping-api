import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AdminComboQueryDto } from '../dto/admin-combo-query.dto';
import { CreateComboDto } from '../dto/create-combo.dto';
import { UpdateComboDto } from '../dto/update-combo.dto';
import { CombosService } from '../services/combos.service';

/** Quản lý combo (Back-office). Guard admin qua @RequirePermission mỗi route. */
@ApiTags('admin/combos')
@ApiBearerAuth()
@Controller('admin/combos')
export class AdminCombosController {
  constructor(private readonly combos: CombosService) {}

  @Get()
  @RequirePermission('catalog.view')
  @ApiOperation({
    summary: 'Danh sách combo — lọc trạng thái, tìm, phân trang',
  })
  findAll(@Query() query: AdminComboQueryDto) {
    return this.combos.findAllAdmin(query);
  }

  @Get(':id')
  @RequirePermission('catalog.view')
  @ApiOperation({ summary: 'Chi tiết combo (kèm thành phần, tồn khả dụng)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.combos.findOneAdmin(id);
  }

  @Post()
  @RequirePermission('catalog.create')
  @ApiOperation({ summary: 'Tạo combo' })
  create(@Body() dto: CreateComboDto) {
    return this.combos.create(dto);
  }

  @Patch(':id')
  @RequirePermission('catalog.update')
  @ApiOperation({ summary: 'Sửa combo (gửi items = thay toàn bộ thành phần)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateComboDto) {
    return this.combos.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('catalog.delete')
  @ApiOperation({ summary: 'Xóa combo' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.combos.remove(id);
  }
}
