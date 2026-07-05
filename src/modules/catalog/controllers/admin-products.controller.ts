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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CustomerRole } from '../../../common/enums';
import { RolesGuard } from '../../auth/guards/roles.guard';
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
@UseGuards(RolesGuard)
@Roles(CustomerRole.ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products (raw entity, {data, meta})' })
  findAll(@Query() query: ProductQueryDto) {
    return this.products.listRaw(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by id (raw entity)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.findOne(id);
  }

  @Get(':id/inventory-summary')
  @ApiOperation({
    summary:
      'Per-branch stock summed across the product\'s variants — powers the status-change confirm dialog',
  })
  inventorySummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.inventorySummary(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a product (with variants)' })
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a product' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.remove(id);
  }
}
