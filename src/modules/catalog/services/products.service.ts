import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { InventoryService } from '../../branches/services/inventory.service';
import {
  indexInventory,
  toProduct,
  toProductSummary,
  type FacetDto,
  type FacetOptionDto,
  type InventoryMap,
  type ProductDto,
  type ProductSummaryDto,
} from '../serializers/catalog.serializer';

export interface ProductListDto {
  items: ProductSummaryDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  facets: FacetDto[];
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly categories: CategoriesRepository,
    private readonly inventory: InventoryService,
  ) {}

  /** Per-variant inventory for a set of products (one query, avoids N+1). */
  private async inventoryFor(products: Product[]): Promise<InventoryMap> {
    const variantIds = products.flatMap((p) =>
      (p.variants ?? []).map((v) => v.id),
    );
    return indexInventory(await this.inventory.findForVariants(variantIds));
  }

  /** Storefront product list — FE-shaped, with branch stock + facets. */
  async list(query: ProductQueryDto): Promise<ProductListDto> {
    const [[data, total], facets] = await Promise.all([
      this.products.search(query),
      this.buildFacets(query),
    ]);
    const inv = await this.inventoryFor(data);
    return {
      items: data.map((p) => toProductSummary(p, inv)),
      pagination: {
        page: query.page,
        pageSize: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 0,
      },
      facets,
    };
  }

  /** Lightweight typeahead: matching product summaries + total (no facets). */
  async suggest(
    q: string,
    limit = 6,
  ): Promise<{ products: ProductSummaryDto[]; total: number }> {
    const query = { q, limit, page: 1, skip: 0 } as ProductQueryDto;
    const [data, total] = await this.products.search(query);
    const inv = await this.inventoryFor(data);
    return { products: data.map((p) => toProductSummary(p, inv)), total };
  }

  /** Brand + attribute facets (checkbox) over the base set. Price range is handled
   *  by the FE via min/max, so it's not emitted here (matches the storefront contract). */
  private async buildFacets(query: ProductQueryDto): Promise<FacetDto[]> {
    const [brands, attrRows] = await Promise.all([
      this.products.facetBrands(query),
      this.products.facetAttributes(query),
    ]);

    const facets: FacetDto[] = [];
    if (brands.length) {
      facets.push({
        key: 'brand',
        label: 'Thương hiệu',
        type: 'checkbox',
        options: brands.map((b) => ({
          value: b.value,
          label: b.label,
          count: b.count,
        })),
      });
    }

    const byKey = new Map<
      string,
      { label: string; options: FacetOptionDto[] }
    >();
    for (const r of attrRows) {
      const entry = byKey.get(r.key) ?? { label: r.label, options: [] };
      entry.options.push({
        value: r.value,
        label: r.value,
        count: Number(r.count),
      });
      byKey.set(r.key, entry);
    }
    for (const [key, entry] of byKey) {
      facets.push({
        key,
        label: entry.label,
        type: 'checkbox',
        options: entry.options,
      });
    }
    return facets;
  }

  /** FE-shaped summaries for a set of ids (e.g. wishlist items). Order follows `ids`. */
  async summariesByIds(ids: string[]): Promise<ProductSummaryDto[]> {
    if (!ids.length) return [];
    const products = await this.products.findByIds(ids);
    const inv = await this.inventoryFor(products);
    const byId = new Map(products.map((p) => [p.id, toProductSummary(p, inv)]));
    return ids
      .map((id) => byId.get(id))
      .filter((s): s is ProductSummaryDto => !!s);
  }

  /** Full FE-shaped details for a set of ids (variants included). Batched (2 queries). */
  async detailsByIds(ids: string[]): Promise<ProductDto[]> {
    if (!ids.length) return [];
    const products = await this.products.findByIds(ids);
    const inv = await this.inventoryFor(products);
    return products.map((p) => toProduct(p, inv));
  }

  /** Storefront product detail (FE-shaped). */
  async detailBySlug(slug: string): Promise<ProductDto> {
    const product = await this.findBySlug(slug);
    return toProduct(product, await this.inventoryFor([product]));
  }

  async detailById(id: string): Promise<ProductDto> {
    const product = await this.findOne(id);
    return toProduct(product, await this.inventoryFor([product]));
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
    // Strip relation inputs; only scalar columns get assigned here.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
