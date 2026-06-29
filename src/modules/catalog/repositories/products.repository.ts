import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ProductQueryDto, parseAttrs } from '../dto/product.dto';
import { ProductVariant } from '../entities/product-variant.entity';
import { Product } from '../entities/product.entity';

export interface FacetCountRow {
  value: string;
  label: string;
  count: number;
}
export interface AttrFacetRow {
  key: string;
  label: string;
  value: string;
  count: number;
}

const SORTABLE = new Set(['createdAt', 'basePrice', 'name', 'ratingAvg']);

const FULL_RELATIONS = {
  brand: true,
  categories: true,
  images: true,
  attributes: true,
  options: { values: true },
  variants: { optionValues: true },
} as const;

@Injectable()
export class ProductsRepository {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
  ) {}

  create(data: Partial<Product>): Product {
    return this.repo.create(data);
  }

  save(product: Product): Promise<Product> {
    return this.repo.save(product);
  }

  remove(product: Product): Promise<Product> {
    return this.repo.remove(product);
  }

  findBySlug(slug: string): Promise<Product | null> {
    return this.repo.findOne({ where: { slug }, relations: FULL_RELATIONS });
  }

  findById(id: string): Promise<Product | null> {
    return this.repo.findOne({ where: { id }, relations: FULL_RELATIONS });
  }

  /** Filtered + sorted + paginated search → [items, total]. */
  async search(query: ProductQueryDto): Promise<[Product[], number]> {
    const qb = this.repo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.images', 'image')
      .leftJoinAndSelect('product.variants', 'variant')
      .leftJoinAndSelect('product.options', 'option')
      .leftJoinAndSelect('option.values', 'optionValue')
      .leftJoinAndSelect('product.categories', 'category');

    if (query.status) {
      qb.andWhere('product.status = :status', { status: query.status });
    }
    if (query.q) {
      qb.andWhere(
        '(unaccent(product.name) ILIKE unaccent(:q) OR unaccent(product.description) ILIKE unaccent(:q))',
        { q: `%${query.q}%` },
      );
    }
    if (query.category) {
      qb.andWhere('category.slug = :slug', { slug: query.category });
    }
    this.applyAdvancedFilters(qb, query);

    const [sortField, sortDir] = (query.sort ?? 'createdAt:DESC').split(':');
    const field = SORTABLE.has(sortField) ? sortField : 'createdAt';
    const dir = sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`product.${field}`, dir as 'ASC' | 'DESC')
      .skip(query.skip)
      .take(query.limit);

    return qb.getManyAndCount();
  }

  /** Price range / brand / attribute filters (used by search; NOT by facet bases). */
  private applyAdvancedFilters(
    qb: SelectQueryBuilder<Product>,
    query: ProductQueryDto,
  ): void {
    if (query.minPrice != null || query.maxPrice != null) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = product.id AND pv.price >= :minP AND pv.price <= :maxP)',
        {
          minP: query.minPrice ?? 0,
          maxP: query.maxPrice ?? Number.MAX_SAFE_INTEGER,
        },
      );
    }
    if (query.brand?.length) {
      qb.andWhere('brand.slug IN (:...brands)', { brands: query.brand });
    }
    if (query.branchId) {
      // Only products carried at the branch (have an inventory record there).
      qb.andWhere(
        'EXISTS (SELECT 1 FROM inventory iv JOIN product_variants pvb ON pvb.id = iv.variant_id WHERE pvb.product_id = product.id AND iv.branch_id = :branchId)',
        { branchId: query.branchId },
      );
    }
    let ai = 0;
    for (const [key, values] of parseAttrs(query.attrs)) {
      const params: Record<string, string> = { [`ak${ai}`]: key };
      const conds = values
        .map((v, j) => {
          params[`av${ai}_${j}`] = v;
          return `pa.value @> to_jsonb(:av${ai}_${j}::text)`;
        })
        .join(' OR ');
      qb.andWhere(
        `EXISTS (SELECT 1 FROM product_attributes pa WHERE pa.product_id = product.id AND pa.key = :ak${ai} AND (${conds}))`,
        params,
      );
      ai++;
    }
  }

  /** Base filters (category/search/status) for facet counts — excludes facet selections. */
  private applyFacetBase(
    qb: SelectQueryBuilder<Product>,
    query: ProductQueryDto,
  ): void {
    if (query.status)
      qb.andWhere('product.status = :status', { status: query.status });
    if (query.q) {
      qb.andWhere(
        '(unaccent(product.name) ILIKE unaccent(:q) OR unaccent(product.description) ILIKE unaccent(:q))',
        { q: `%${query.q}%` },
      );
    }
    if (query.category) {
      qb.innerJoin('product.categories', 'fc').andWhere('fc.slug = :slug', {
        slug: query.category,
      });
    }
  }

  /** Brand facet counts over the base (category/search/status) set. */
  async facetBrands(query: ProductQueryDto): Promise<FacetCountRow[]> {
    const qb = this.repo
      .createQueryBuilder('product')
      .innerJoin('product.brand', 'brand')
      .select('brand.slug', 'value')
      .addSelect('brand.name', 'label')
      .addSelect('COUNT(DISTINCT product.id)', 'count');
    this.applyFacetBase(qb, query);
    const rows = await qb
      .groupBy('brand.slug')
      .addGroupBy('brand.name')
      .orderBy('count', 'DESC')
      .getRawMany<{ value: string; label: string; count: string }>();
    return rows.map((r) => ({
      value: r.value,
      label: r.label,
      count: Number(r.count),
    }));
  }

  /** Attribute facet counts (handles jsonb scalar + array) over the base set. */
  async facetAttributes(query: ProductQueryDto): Promise<AttrFacetRow[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (query.status) {
      where.push(`p.status = $${i++}`);
      params.push(query.status);
    }
    if (query.q) {
      where.push(
        `(unaccent(p.name) ILIKE unaccent($${i}) OR unaccent(p.description) ILIKE unaccent($${i}))`,
      );
      params.push(`%${query.q}%`);
      i++;
    }
    let catJoin = '';
    if (query.category) {
      catJoin =
        'JOIN product_categories pc ON pc.product_id = p.id JOIN categories c ON c.id = pc.category_id';
      where.push(`c.slug = $${i++}`);
      params.push(query.category);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `
      SELECT pa.key AS key, pa.label AS label, x.val AS value, COUNT(DISTINCT p.id)::int AS count
      FROM products p
      JOIN product_attributes pa ON pa.product_id = p.id
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(pa.value) = 'array' THEN pa.value
             ELSE jsonb_build_array(pa.value) END
      ) AS x(val)
      ${catJoin}
      ${whereSql}
      GROUP BY pa.key, pa.label, x.val
      ORDER BY pa.key, count DESC
    `;
    return this.repo.manager.query(sql, params) as Promise<AttrFacetRow[]>;
  }

  // ── Variants ──────────────────────────────────────────────────────
  createVariant(data: Partial<ProductVariant>): ProductVariant {
    return this.variantRepo.create(data);
  }

  saveVariants(variants: ProductVariant[]): Promise<ProductVariant[]> {
    return this.variantRepo.save(variants);
  }

  findVariantById(id: string): Promise<ProductVariant | null> {
    return this.variantRepo.findOne({
      where: { id },
      relations: { product: true },
    });
  }
}
