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
import {
  CreateCategoryAttributeDto,
  UpdateCategoryAttributeDto,
} from '../dto/category-attribute.dto';
import { CategoryAttributesService } from '../services/category-attributes.service';

@ApiTags('categories')
@Controller('categories/:categoryId/attributes')
export class CategoryAttributesController {
  constructor(private readonly attributes: CategoryAttributesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List a category’s attribute (filter) templates' })
  findAll(@Param('categoryId', ParseUUIDPipe) categoryId: string) {
    return this.attributes.findByCategory(categoryId);
  }

  @Post()
  @ApiBearerAuth()
  @RequirePermission('catalog.create')
  @ApiOperation({
    summary: '[admin] Define a new attribute template for a category',
  })
  create(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: CreateCategoryAttributeDto,
  ) {
    return this.attributes.create(categoryId, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @RequirePermission('catalog.update')
  @ApiOperation({ summary: '[admin] Update an attribute template' })
  update(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryAttributeDto,
  ) {
    return this.attributes.update(categoryId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiBearerAuth()
  @RequirePermission('catalog.delete')
  @ApiOperation({ summary: '[admin] Delete an attribute template' })
  remove(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.attributes.remove(categoryId, id);
  }
}
