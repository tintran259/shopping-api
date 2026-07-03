import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { ProductQueryDto } from '../dto/product.dto';
import { ProductsService } from '../services/products.service';

/**
 * Public storefront catalog. Returns FE-shaped DTOs (thumbnail, price object,
 * facets). Admin write/raw-read operations live in AdminProductsController
 * (`/admin/products`).
 */
@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List products (paginated, filterable) — storefront shape',
  })
  findAll(@Query() query: ProductQueryDto) {
    return this.products.list(query);
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a product by slug — storefront shape' })
  findBySlug(@Param('slug') slug: string) {
    return this.products.detailBySlug(slug);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a product by id — storefront shape' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.detailById(id);
  }
}
