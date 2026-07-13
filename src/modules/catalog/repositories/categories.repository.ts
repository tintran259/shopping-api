import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Category } from '../entities/category.entity';

/** A category row with its own direct product count attached — 0 for
 *  non-leaf nodes (products only ever attach to leaves; the admin list rolls
 *  up subtree totals client-side from these per-node counts). */
export type CategoryWithProductCount = Category & { productsCount: number };

@Injectable()
export class CategoriesRepository {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
  ) {}

  /** Accent-insensitive name match for search suggestions ("tra" → "Trà"). */
  searchByName(q: string, limit: number): Promise<Category[]> {
    return this.repo
      .createQueryBuilder('c')
      .where('unaccent(c.name) ILIKE unaccent(:q)', { q: `%${q}%` })
      .orderBy('c.name', 'ASC')
      .take(limit)
      .getMany();
  }

  create(data: Partial<Category>): Category {
    return this.repo.create(data);
  }

  save(category: Category): Promise<Category> {
    return this.repo.save(category);
  }

  remove(category: Category): Promise<Category> {
    return this.repo.remove(category);
  }

  async findAll(): Promise<CategoryWithProductCount[]> {
    const rows = await this.repo
      .createQueryBuilder('c')
      .loadRelationCountAndMap('c.productsCount', 'c.products')
      .orderBy('c.sortOrder', 'ASC')
      .addOrderBy('c.name', 'ASC')
      .getMany();
    return rows as CategoryWithProductCount[];
  }

  findById(id: string): Promise<Category | null> {
    return this.repo.findOne({
      where: { id },
      relations: { children: true, parent: true },
    });
  }

  findBySlug(slug: string): Promise<Category | null> {
    return this.repo.findOne({ where: { slug } });
  }

  findByIds(ids: string[]): Promise<Category[]> {
    return this.repo.findBy({ id: In(ids) });
  }

  /** Bulk sortOrder update for a drag-and-drop reorder — one transaction
   *  instead of the FE firing one PATCH per moved row. */
  async reorder(items: { id: string; sortOrder: number }[]): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      await Promise.all(
        items.map((item) =>
          manager.update(
            Category,
            { id: item.id },
            { sortOrder: item.sortOrder },
          ),
        ),
      );
    });
  }
}
