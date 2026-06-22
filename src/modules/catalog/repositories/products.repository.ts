import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductQueryDto } from '../dto/product.dto';
import { ProductVariant } from '../entities/product-variant.entity';
import { Product } from '../entities/product.entity';

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
      .leftJoinAndSelect('product.categories', 'category');

    if (query.status) {
      qb.andWhere('product.status = :status', { status: query.status });
    }
    if (query.q) {
      qb.andWhere('(product.name ILIKE :q OR product.description ILIKE :q)', {
        q: `%${query.q}%`,
      });
    }
    if (query.category) {
      qb.andWhere('category.slug = :slug', { slug: query.category });
    }

    const [sortField, sortDir] = (query.sort ?? 'createdAt:DESC').split(':');
    const field = SORTABLE.has(sortField) ? sortField : 'createdAt';
    const dir = sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`product.${field}`, dir as 'ASC' | 'DESC')
      .skip(query.skip)
      .take(query.limit);

    return qb.getManyAndCount();
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
