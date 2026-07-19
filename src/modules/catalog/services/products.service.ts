import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryFailedError, type EntityManager } from 'typeorm';
import { ProductStatus } from '../../../common/enums';
import { PaginatedResult } from '../../../common/dto/paginated-result';
import {
  CreateProductDto,
  ProductAttributeInput,
  ProductImageInput,
  ProductOptionInput,
  ProductQueryDto,
  UpdateProductDto,
  VariantInput,
} from '../dto/product.dto';
import { Category } from '../entities/category.entity';
import { ProductAttribute } from '../entities/product-attribute.entity';
import { ProductImage } from '../entities/product-image.entity';
import { ProductOption } from '../entities/product-option.entity';
import { ProductOptionValue } from '../entities/product-option-value.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { Product } from '../entities/product.entity';
import { CategoriesRepository } from '../repositories/categories.repository';
import { ProductsRepository } from '../repositories/products.repository';
import {
  InventoryService,
  LOCKED_PRODUCT_STATUSES,
} from '../../branches/services/inventory.service';
import { BranchesService } from '../../branches/services/branches.service';
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

/** Never publicly browsable/reachable, regardless of what a caller's `status`
 *  query param says — draft is unfinished, discontinued is retired. Admin
 *  (`listRaw`/raw `findOne`/`findBySlug`) is exempt: the BO must see every
 *  status to manage it. */
const HIDDEN_PUBLIC_STATUSES = [
  ProductStatus.DRAFT,
  ProductStatus.DISCONTINUED,
];

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
    private readonly branches: BranchesService,
    private readonly dataSource: DataSource,
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
      this.products.search(query, { excludeStatuses: HIDDEN_PUBLIC_STATUSES }),
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

  /**
   * Admin list — same filters/sort/pagination as {@link list} but returns the
   * raw product entities (with relations) in the standard {data, meta} envelope,
   * so the back-office edits against the real shape (basePrice, variants, …).
   */
  async listRaw(query: ProductQueryDto): Promise<PaginatedResult<Product>> {
    const [data, total] = await this.products.search(query);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  /** Lightweight typeahead: matching product summaries + total (no facets). */
  async suggest(
    q: string,
    limit = 6,
  ): Promise<{ products: ProductSummaryDto[]; total: number }> {
    const query = { q, limit, page: 1, skip: 0 } as ProductQueryDto;
    const [data, total] = await this.products.search(query, {
      excludeStatuses: HIDDEN_PUBLIC_STATUSES,
    });
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
    this.assertPubliclyVisible(product);
    return toProduct(product, await this.inventoryFor([product]));
  }

  async detailById(id: string): Promise<ProductDto> {
    const product = await this.findOne(id);
    this.assertPubliclyVisible(product);
    return toProduct(product, await this.inventoryFor([product]));
  }

  /** Draft/discontinued must 404 on the public detail routes even by direct
   *  slug/id — same response as "doesn't exist" so it doesn't leak that a
   *  hidden product exists. Admin's raw `findOne`/`findBySlug` are untouched. */
  private assertPubliclyVisible(product: Product): void {
    if (HIDDEN_PUBLIC_STATUSES.includes(product.status)) {
      throw new NotFoundException('Product not found');
    }
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

  /** Product + its variants are created atomically — a variant-save failure
   *  (e.g. a duplicate SKU) must not leave a headless, variant-less product
   *  behind (it previously did: the product save and variant save were two
   *  separate, unrelated statements). */
  async create(dto: CreateProductDto): Promise<Product> {
    if (await this.products.findBySlug(dto.slug)) {
      throw new ConflictException('Product slug already in use');
    }

    const categories = await this.resolveCategories(dto.categoryIds);

    const savedId = await this.dataSource.transaction(async (manager) => {
      const product = manager.create(Product, {
        name: dto.name,
        slug: dto.slug,
        shortDescription: dto.shortDescription,
        description: dto.description,
        status: dto.status,
        brandId: dto.brandId,
        basePrice: dto.basePrice,
        compareAtPrice: dto.compareAtPrice,
        expiryDate: dto.expiryDate,
        categories,
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
      const saved = await manager.save(product);

      if (dto.variants?.length) {
        const lookup = this.optionValueLookup(saved.options ?? []);
        const variants = dto.variants.map((v) =>
          manager.create(ProductVariant, {
            productId: saved.id,
            sku: v.sku,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            imageUrl: v.imageUrl,
            weightGram: v.weightGram,
            optionValues: this.resolveOptionValues(lookup, v.optionValues),
          }),
        );
        await this.saveVariantsOrThrow(() => manager.save(variants));
      }
      return saved.id;
    });

    return this.findOne(savedId);
  }

  /**
   * Full-replace update for scalars + every relation the BO edits (images,
   * attributes, options, variants) — omit a key entirely to leave it untouched.
   * Images/attributes are a plain delete-then-recreate (nothing references them
   * downstream). Options/variants need the careful order below: create the new
   * option values FIRST, re-point every variant at them, THEN delete the old
   * option rows — so nothing is ever left referencing a row mid-delete. Variants
   * matched by `id` are updated in place (keeps their history/inventory);
   * unmatched incoming rows are new, and existing rows missing from the payload
   * are removed (their inventory/cart lines cascade — the BO removed that combo).
   */
  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    if (dto.categoryIds) {
      product.categories = await this.resolveCategories(dto.categoryIds);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { categoryIds, images, attributes, options, variants, ...scalars } =
      dto;
    Object.assign(product, scalars);
    await this.products.save(product);

    await this.dataSource.transaction(async (manager) => {
      if (images) await this.replaceImages(manager, id, images);
      if (attributes) await this.replaceAttributes(manager, id, attributes);
      if (options || variants) {
        await this.syncOptionsAndVariants(manager, product, options, variants);
      }
    });

    // Taking a product off sale must not leave stale stock lying around that
    // display logic elsewhere reads as "available" — force every branch back
    // to 0/out_of_stock. The BO shows a confirm dialog with today's per-branch
    // quantities before letting the admin pick either status (see
    // `inventorySummary` below); this is what actually carries it out.
    if (dto.status && LOCKED_PRODUCT_STATUSES.includes(dto.status)) {
      await this.inventory.resetAllForProduct(id);
    }

    return this.findOne(id);
  }

  /** Per-branch stock summed across every variant of a product — powers the
   *  confirm dialog shown before switching a product to out_of_stock/
   *  discontinued (see {@link update}), so the admin sees what's about to be
   *  zeroed instead of finding out after the fact. Branch name is joined here
   *  (not left to the FE) so that dialog doesn't need its own branch lookup. */
  async inventorySummary(id: string): Promise<
    {
      branchId: string;
      branchName: string;
      quantity: number;
      reserved: number;
    }[]
  > {
    const product = await this.findOne(id);
    const variantIds = (product.variants ?? []).map((v) => v.id);
    const [rows, allBranches] = await Promise.all([
      this.inventory.findForVariants(variantIds),
      this.branches.findAll(),
    ]);
    const branchName = new Map(allBranches.map((b) => [b.id, b.name]));
    const byBranch = new Map<string, { quantity: number; reserved: number }>();
    for (const r of rows) {
      const entry = byBranch.get(r.branchId) ?? { quantity: 0, reserved: 0 };
      entry.quantity += r.quantity;
      entry.reserved += r.reserved;
      byBranch.set(r.branchId, entry);
    }
    return [...byBranch.entries()].map(([branchId, v]) => ({
      branchId,
      branchName: branchName.get(branchId) ?? branchId,
      ...v,
    }));
  }

  async remove(id: string): Promise<void> {
    await this.products.remove(await this.findOne(id));
  }

  async getVariantOrFail(variantId: string): Promise<ProductVariant> {
    const variant = await this.products.findVariantById(variantId);
    if (!variant) throw new NotFoundException('Product variant not found');
    return variant;
  }

  /** Record a completed sale: bump every product's `soldCount` by the quantity
   *  ordered. Called once when an order transitions to DELIVERED (the caller
   *  guards against double-counting). Optionally joins an existing transaction. */
  async recordSaleForOrder(
    orderId: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.products.incrementSoldCountForOrder(orderId, manager);
  }

  private async replaceImages(
    manager: EntityManager,
    productId: string,
    images: ProductImageInput[],
  ): Promise<void> {
    await manager.delete(ProductImage, { productId });
    if (!images.length) return;
    await manager.save(
      images.map((img, i) =>
        manager.create(ProductImage, {
          productId,
          url: img.url,
          alt: img.alt,
          isPrimary: img.isPrimary ?? i === 0,
          sortOrder: i,
        }),
      ),
    );
  }

  private async replaceAttributes(
    manager: EntityManager,
    productId: string,
    attributes: ProductAttributeInput[],
  ): Promise<void> {
    await manager.delete(ProductAttribute, { productId });
    if (!attributes.length) return;
    await manager.save(
      attributes.map((a) =>
        manager.create(ProductAttribute, { ...a, productId }),
      ),
    );
  }

  /** SKU is globally unique (see the `product_variants` index) — saving a
   *  batch with a repeated SKU (typo, copy-pasted row, or a clash with another
   *  product) hits that constraint. Surface it as a clear 409, not a raw 500. */
  private async saveVariantsOrThrow<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          'Mã SKU bị trùng — mỗi biến thể (và mọi sản phẩm khác trong hệ thống) cần một mã SKU riêng.',
        );
      }
      throw error;
    }
  }

  /** `optionName::value` → the saved {@link ProductOptionValue} row. */
  private optionValueLookup(
    options: { name: string; values?: ProductOptionValue[] }[],
  ): Map<string, ProductOptionValue> {
    const lookup = new Map<string, ProductOptionValue>();
    for (const opt of options) {
      for (const val of opt.values ?? []) {
        lookup.set(`${opt.name}::${val.value}`, val);
      }
    }
    return lookup;
  }

  /** Resolve a variant's `{ optionName: value }` selections against the
   *  product's declared options. Throws instead of silently dropping a
   *  mismatch (a stray typo used to save a variant with no option link at
   *  all, with no error to say so). */
  private resolveOptionValues(
    lookup: Map<string, ProductOptionValue>,
    optionValues: Record<string, string> | undefined,
  ): ProductOptionValue[] {
    return Object.entries(optionValues ?? {}).map(([optName, val]) => {
      const match = lookup.get(`${optName}::${val}`);
      if (!match) {
        throw new BadRequestException(
          `Giá trị tùy chọn "${optName}: ${val}" chưa được khai báo trong phần Tùy chọn của sản phẩm.`,
        );
      }
      return match;
    });
  }

  private async syncOptionsAndVariants(
    manager: EntityManager,
    product: Product,
    options: ProductOptionInput[] | undefined,
    variants: VariantInput[] | undefined,
  ): Promise<void> {
    const oldOptions = options
      ? await manager.find(ProductOption, { where: { productId: product.id } })
      : (product.options ?? []);

    let lookup: Map<string, ProductOptionValue>;
    if (options) {
      const created = options.map((opt, i) =>
        manager.create(ProductOption, {
          productId: product.id,
          name: opt.name,
          displayType: opt.displayType,
          sortOrder: i,
          values: opt.values.map((v, j) =>
            manager.create(ProductOptionValue, { value: v, sortOrder: j }),
          ),
        }),
      );
      const saved = await manager.save(created);
      lookup = this.optionValueLookup(saved);
    } else {
      lookup = this.optionValueLookup(oldOptions);
    }

    if (variants) {
      const existing = await manager.find(ProductVariant, {
        where: { productId: product.id },
        relations: { optionValues: true },
      });
      const existingById = new Map(existing.map((v) => [v.id, v]));
      const keepIds = new Set<string>();

      const toSave = variants.map((v) => {
        const optionValues = this.resolveOptionValues(lookup, v.optionValues);
        const current = v.id ? existingById.get(v.id) : undefined;
        if (current) {
          keepIds.add(current.id);
          return manager.merge(ProductVariant, current, {
            sku: v.sku,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            imageUrl: v.imageUrl,
            weightGram: v.weightGram,
            optionValues,
          });
        }
        return manager.create(ProductVariant, {
          productId: product.id,
          sku: v.sku,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          imageUrl: v.imageUrl,
          weightGram: v.weightGram,
          optionValues,
        });
      });
      await this.saveVariantsOrThrow(() => manager.save(toSave));

      const toRemove = existing.filter((v) => !keepIds.has(v.id));
      if (toRemove.length) await manager.remove(toRemove);
    } else if (options) {
      // Options changed but variants weren't resent — re-point the existing
      // variants at the freshly created option values so nothing is left
      // dangling on the old (about-to-be-deleted) rows.
      for (const v of product.variants ?? []) {
        const byName = new Map(
          (v.optionValues ?? []).map((ov) => {
            const opt = oldOptions.find((o) =>
              (o.values ?? []).some((val) => val.id === ov.id),
            );
            return [opt?.name ?? '', ov.value] as const;
          }),
        );
        v.optionValues = this.resolveOptionValues(
          lookup,
          Object.fromEntries(byName),
        );
      }
      await manager.save(product.variants ?? []);
    }

    if (options && oldOptions.length) {
      // Safe now: every variant above was re-saved against the NEW option
      // values, so nothing still references these rows.
      await manager.remove(oldOptions);
    }
  }

  private async resolveCategories(ids?: string[]): Promise<Category[]> {
    if (!ids?.length) return [];
    return this.categories.findByIds(ids);
  }
}
