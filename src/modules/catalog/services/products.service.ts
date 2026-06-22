import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedResult } from '../../../common/dto/paginated-result';
import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
  VariantInput,
} from '../dto/product.dto';
import { Category } from '../entities/category.entity';
import { ProductOptionValue } from '../entities/product-option-value.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { Product } from '../entities/product.entity';
import { CategoriesRepository } from '../repositories/categories.repository';
import { ProductsRepository } from '../repositories/products.repository';

@Injectable()
export class ProductsService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly categories: CategoriesRepository,
  ) {}

  async findAll(query: ProductQueryDto): Promise<PaginatedResult<Product>> {
    const [data, total] = await this.products.search(query);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.products.findById(id);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.products.findBySlug(slug);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    if (await this.products.findBySlug(dto.slug)) {
      throw new ConflictException('Product slug already in use');
    }

    const product = this.products.create({
      name: dto.name,
      slug: dto.slug,
      shortDescription: dto.shortDescription,
      description: dto.description,
      status: dto.status,
      brandId: dto.brandId,
      basePrice: dto.basePrice,
      compareAtPrice: dto.compareAtPrice,
      categories: await this.resolveCategories(dto.categoryIds),
      images: (dto.images ?? []).map((img, i) => ({
        url: img.url,
        alt: img.alt,
        isPrimary: img.isPrimary ?? i === 0,
        sortOrder: i,
      })) as any,
      attributes: (dto.attributes ?? []) as any,
      options: (dto.options ?? []).map((opt, i) => ({
        name: opt.name,
        displayType: opt.displayType,
        sortOrder: i,
        values: opt.values.map((v, j) => ({ value: v, sortOrder: j })),
      })) as any,
    });
    const saved = await this.products.save(product);

    if (dto.variants?.length) {
      await this.products.saveVariants(this.buildVariants(saved, dto.variants));
    }
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    if (dto.categoryIds) {
      product.categories = await this.resolveCategories(dto.categoryIds);
    }
    const { categoryIds, images, attributes, options, variants, ...scalars } =
      dto;
    Object.assign(product, scalars);
    await this.products.save(product);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.products.remove(await this.findOne(id));
  }

  async getVariantOrFail(variantId: string): Promise<ProductVariant> {
    const variant = await this.products.findVariantById(variantId);
    if (!variant) throw new NotFoundException('Product variant not found');
    return variant;
  }

  /** Map each variant's { optionName: value } selections to saved option values. */
  private buildVariants(
    product: Product,
    inputs: VariantInput[],
  ): ProductVariant[] {
    const lookup = new Map<string, ProductOptionValue>();
    for (const opt of product.options ?? []) {
      for (const val of opt.values ?? []) {
        lookup.set(`${opt.name}::${val.value}`, val);
      }
    }
    return inputs.map((v) => {
      const optionValues: ProductOptionValue[] = [];
      for (const [optName, val] of Object.entries(v.optionValues ?? {})) {
        const match = lookup.get(`${optName}::${val}`);
        if (match) optionValues.push(match);
      }
      return this.products.createVariant({
        productId: product.id,
        sku: v.sku,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        imageUrl: v.imageUrl,
        optionValues,
      });
    });
  }

  private async resolveCategories(ids?: string[]): Promise<Category[]> {
    if (!ids?.length) return [];
    return this.categories.findByIds(ids);
  }
}
