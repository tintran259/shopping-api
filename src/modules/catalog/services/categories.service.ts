import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateCategoryDto,
  ReorderCategoriesDto,
  UpdateCategoryDto,
} from '../dto/category.dto';
import { Category } from '../entities/category.entity';
import {
  CategoriesRepository,
  CategoryWithProductCount,
} from '../repositories/categories.repository';

/** Root = 0, child = 1, grandchild = 2. Grandchild is always a leaf — nothing
 *  may be created under it. */
const MAX_DEPTH = 2;

@Injectable()
export class CategoriesService {
  constructor(private readonly categories: CategoriesRepository) {}

  /** In-memory cache for the full category list. Reads happen far more often
   *  than writes for a tree that changes rarely, and every read otherwise
   *  pays for a per-row correlated subquery (`productsCount`) — cheap at a
   *  handful of categories, not free at the thousands a large catalog can
   *  reach. Invalidated synchronously on every write (create/update/remove/
   *  reorder) so an admin always sees their own change immediately; the TTL
   *  is just a safety net, not the primary invalidation path. Single-process
   *  only — a multi-instance deployment would need a shared cache (Redis)
   *  instead of this. */
  private cachedAll: {
    data: CategoryWithProductCount[];
    expiresAt: number;
  } | null = null;
  private static readonly CACHE_TTL_MS = 5 * 60_000;

  async findAll(): Promise<CategoryWithProductCount[]> {
    const now = Date.now();
    if (this.cachedAll && this.cachedAll.expiresAt > now) {
      return this.cachedAll.data;
    }
    const data = await this.categories.findAll();
    this.cachedAll = { data, expiresAt: now + CategoriesService.CACHE_TTL_MS };
    return data;
  }

  private invalidateCache(): void {
    this.cachedAll = null;
  }

  /** Categories matching a search term (for search suggestions). */
  search(q: string, limit = 4): Promise<Category[]> {
    return this.categories.searchByName(q, limit);
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categories.findById(id);
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    await this.assertSlugFree(dto.slug);
    await this.assertValidParent(dto.parentId);
    const category = await this.categories.save(this.categories.create(dto));
    this.invalidateCache();
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    if (dto.slug && dto.slug !== category.slug) {
      await this.assertSlugFree(dto.slug);
    }
    if (dto.parentId !== undefined && dto.parentId !== category.parentId) {
      await this.assertValidParent(dto.parentId, id);
    }
    Object.assign(category, dto);
    const saved = await this.categories.save(category);
    this.invalidateCache();
    return saved;
  }

  async remove(id: string): Promise<void> {
    await this.categories.remove(await this.findOne(id));
    this.invalidateCache();
  }

  /** Bulk sortOrder update for one drag-and-drop reorder — a single request
   *  instead of the FE firing one PATCH per moved row. */
  async reorder(dto: ReorderCategoriesDto): Promise<void> {
    await this.categories.reorder(dto.items);
    this.invalidateCache();
  }

  private async assertSlugFree(slug: string): Promise<void> {
    if (await this.categories.findBySlug(slug)) {
      throw new ConflictException('Category slug already in use');
    }
  }

  /** Enforces the 3-level cap and (on update, where a cycle is possible)
   *  rejects setting a parent that is actually one of `selfId`'s own
   *  descendants. Walking the chain is cheap — at most 2 hops by construction. */
  private async assertValidParent(
    parentId: string | undefined,
    selfId?: string,
  ): Promise<void> {
    if (!parentId) return;
    if (parentId === selfId) {
      throw new BadRequestException('Danh mục không thể là cha của chính nó');
    }

    let depth = 0;
    let cursor: Category | null = await this.categories.findById(parentId);
    if (!cursor) throw new NotFoundException('Danh mục cha không tồn tại');

    while (cursor.parentId) {
      if (selfId && cursor.parentId === selfId) {
        throw new BadRequestException(
          'Không thể chọn một danh mục con của chính nó làm danh mục cha',
        );
      }
      depth++;
      cursor = await this.categories.findById(cursor.parentId);
      if (!cursor) break;
    }

    if (depth >= MAX_DEPTH) {
      throw new BadRequestException(
        'Danh mục cha đã ở cấp sâu nhất — không thể thêm danh mục con vào đây',
      );
    }
  }
}
