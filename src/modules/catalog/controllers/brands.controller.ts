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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { BrandsService } from '../services/brands.service';
import { CreateBrandDto, UpdateBrandDto } from '../dto/brand.dto';

@ApiTags('brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List brands' })
  findAll() {
    return this.brands.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a brand' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.brands.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @RequirePermission('catalog.create')
  @ApiOperation({ summary: '[admin] Create a brand' })
  create(@Body() dto: CreateBrandDto) {
    return this.brands.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @RequirePermission('catalog.update')
  @ApiOperation({ summary: '[admin] Update a brand' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBrandDto) {
    return this.brands.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiBearerAuth()
  @RequirePermission('catalog.delete')
  @ApiOperation({ summary: '[admin] Delete a brand' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.brands.remove(id);
  }
}
