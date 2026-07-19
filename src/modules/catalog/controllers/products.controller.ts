import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { ProductReviewsQueryDto } from '../../reviews/dto/review.dto';
import { ReviewsService } from '../../reviews/services/reviews.service';
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
  constructor(
    private readonly products: ProductsService,
    private readonly reviews: ReviewsService,
  ) {}

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
  @Get(':slug/reviews')
  @ApiOperation({
    summary: 'Published reviews for a product (paginated) + rating aggregate',
  })
  async listReviews(
    @Param('slug') slug: string,
    @Query() query: ProductReviewsQueryDto,
  ) {
    // Resolve the slug here (404s a hidden/absent product) so the reviews
    // module stays keyed on productId and never learns about slugs.
    const product = await this.products.findBySlug(slug);
    return this.reviews.getProductReviews(product.id, query.page, query.limit, query.star);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a product by id — storefront shape' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.detailById(id);
  }
}
