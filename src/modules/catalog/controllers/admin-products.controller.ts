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
import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from '../dto/product.dto';
import { ProductsService } from '../services/products.service';

/**
 * Back-office product management. Guarded for admins at the class level and —
 * unlike the storefront `/products` controller — returns RAW product entities
 * (basePrice, full variants/options/images) so the BO edits real data.
 */
@ApiTags('admin/products')
@ApiBearerAuth()
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermission('catalog.view')
  @ApiOperation({ summary: 'List products (raw entity, {data, meta})' })
  findAll(@Query() query: ProductQueryDto) {
    return this.products.listRaw(query);
  }

  @Get(':id')
  @RequirePermission('catalog.view')
  @ApiOperation({ summary: 'Get a product by id (raw entity)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.findOne(id);
  }

  @Get(':id/inventory-summary')
  @RequirePermission('catalog.view')
  @ApiOperation({
    summary:
      "Per-branch stock summed across the product's variants — powers the status-change confirm dialog",
  })
  inventorySummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.inventorySummary(id);
  }

  @Post()
  @RequirePermission('catalog.create')
  @ApiOperation({ summary: 'Create a product (with variants)' })
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  @RequirePermission('catalog.update')
  @ApiOperation({ summary: 'Update a product' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('catalog.delete')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a product' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.remove(id);
  }
}
