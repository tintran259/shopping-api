import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchesModule } from '../branches/branches.module';
import { BrandsController } from './controllers/brands.controller';
import { CategoriesController } from './controllers/categories.controller';
import { ProductsController } from './controllers/products.controller';
import { Brand } from './entities/brand.entity';
import { Category } from './entities/category.entity';
import { PriceListItem } from './entities/price-list-item.entity';
import { PriceTier } from './entities/price-tier.entity';
import { ProductAttribute } from './entities/product-attribute.entity';
import { ProductImage } from './entities/product-image.entity';
import { ProductOptionValue } from './entities/product-option-value.entity';
import { ProductOption } from './entities/product-option.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { Product } from './entities/product.entity';
import { BrandsRepository } from './repositories/brands.repository';
import { CategoriesRepository } from './repositories/categories.repository';
import { ProductsRepository } from './repositories/products.repository';
import { BrandsService } from './services/brands.service';
import { CategoriesService } from './services/categories.service';
import { ProductsService } from './services/products.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Brand,
      Category,
      Product,
      ProductImage,
      ProductAttribute,
      ProductOption,
      ProductOptionValue,
      ProductVariant,
      PriceTier,
      PriceListItem,
    ]),
    BranchesModule,
  ],
  controllers: [BrandsController, CategoriesController, ProductsController],
  providers: [
    BrandsService,
    CategoriesService,
    ProductsService,
    BrandsRepository,
    CategoriesRepository,
    ProductsRepository,
  ],
  exports: [ProductsService, CategoriesService],
})
export class CatalogModule {}
