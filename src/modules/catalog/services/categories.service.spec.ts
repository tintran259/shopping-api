import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from '../repositories/categories.repository';
import { Category } from '../entities/category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/category.dto';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'id',
    name: 'name',
    slug: 'slug',
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Category;
}

type MockRepo = {
  [K in keyof CategoriesRepository]: jest.Mock;
};

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repo: MockRepo;

  beforeEach(async () => {
    const mockRepo: MockRepo = {
      searchByName: jest.fn(),
      create: jest.fn((data: Partial<Category>) => data as Category),
      save: jest.fn(async (c: Category) => c),
      remove: jest.fn(async (c: Category) => c),
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findByIds: jest.fn(),
      reorder: jest.fn(async () => undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: CategoriesRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get(CategoriesService);
    repo = module.get(CategoriesRepository);
  });

  describe('create', () => {
    it('rejects a duplicate slug with a 409', async () => {
      repo.findBySlug.mockResolvedValue(makeCategory({ slug: 'dup' }));
      await expect(
        service.create({ name: 'A', slug: 'dup' } as CreateCategoryDto),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a root category with no parentId', async () => {
      repo.findBySlug.mockResolvedValue(null);
      const result = await service.create({
        name: 'Root',
        slug: 'root',
      } as CreateCategoryDto);
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(result.slug).toBe('root');
    });

    it('passes SEO metadata straight through to the saved entity', async () => {
      repo.findBySlug.mockResolvedValue(null);
      const seo = { metaTitle: 'Title', metaDescription: 'Description' };
      const result = await service.create({
        name: 'Root',
        slug: 'root',
        seo,
      } as CreateCategoryDto);
      expect(result.seo).toEqual(seo);
    });

    it('allows a child under a root category (depth 0 → 1)', async () => {
      const root = makeCategory({ id: 'root' });
      repo.findBySlug.mockResolvedValue(null);
      repo.findById.mockImplementation(async (id: string) =>
        id === 'root' ? root : null,
      );

      await expect(
        service.create({
          name: 'Child',
          slug: 'child',
          parentId: 'root',
        } as CreateCategoryDto),
      ).resolves.toBeDefined();
    });

    it('allows a grandchild under a child (depth 1 → 2, the deepest leaf level)', async () => {
      const root = makeCategory({ id: 'root' });
      const child = makeCategory({ id: 'child', parentId: 'root' });
      repo.findBySlug.mockResolvedValue(null);
      repo.findById.mockImplementation(async (id: string) => {
        if (id === 'root') return root;
        if (id === 'child') return child;
        return null;
      });

      await expect(
        service.create({
          name: 'Grandchild',
          slug: 'gc',
          parentId: 'child',
        } as CreateCategoryDto),
      ).resolves.toBeDefined();
    });

    it('rejects a 4th level — a grandchild can never have its own children', async () => {
      const root = makeCategory({ id: 'root' });
      const child = makeCategory({ id: 'child', parentId: 'root' });
      const grandchild = makeCategory({ id: 'grandchild', parentId: 'child' });
      repo.findBySlug.mockResolvedValue(null);
      repo.findById.mockImplementation(async (id: string) => {
        if (id === 'root') return root;
        if (id === 'child') return child;
        if (id === 'grandchild') return grandchild;
        return null;
      });

      await expect(
        service.create({
          name: 'GreatGrandchild',
          slug: 'ggc',
          parentId: 'grandchild',
        } as CreateCategoryDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a parentId that does not exist', async () => {
      repo.findBySlug.mockResolvedValue(null);
      repo.findById.mockResolvedValue(null);

      await expect(
        service.create({
          name: 'X',
          slug: 'x',
          parentId: 'missing',
        } as CreateCategoryDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('rejects renaming to a slug already used by a different category', async () => {
      const existing = makeCategory({ id: 'id1', slug: 'old-slug' });
      repo.findById.mockResolvedValue(existing);
      repo.findBySlug.mockResolvedValue(
        makeCategory({ id: 'other', slug: 'taken' }),
      );

      await expect(
        service.update('id1', { slug: 'taken' } as UpdateCategoryDto),
      ).rejects.toThrow(ConflictException);
    });

    it('does not check slug uniqueness when the slug is unchanged', async () => {
      const existing = makeCategory({ id: 'id1', slug: 'same' });
      repo.findById.mockResolvedValue(existing);

      await service.update('id1', { slug: 'same' } as UpdateCategoryDto);

      expect(repo.findBySlug).not.toHaveBeenCalled();
    });

    it('rejects setting a category as its own parent', async () => {
      const existing = makeCategory({ id: 'id1' });
      repo.findById.mockResolvedValue(existing);

      await expect(
        service.update('id1', { parentId: 'id1' } as UpdateCategoryDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects re-parenting a category under its own descendant (cycle)', async () => {
      // id1 (root) → id2 (child) → id3 (grandchild)
      const id1 = makeCategory({ id: 'id1' });
      const id2 = makeCategory({ id: 'id2', parentId: 'id1' });
      const id3 = makeCategory({ id: 'id3', parentId: 'id2' });
      repo.findById.mockImplementation(async (id: string) => {
        if (id === 'id1') return id1;
        if (id === 'id2') return id2;
        if (id === 'id3') return id3;
        return null;
      });

      // id1 is the one being edited; setting its parent to id3 (its own
      // grandchild) would create a cycle.
      await expect(
        service.update('id1', { parentId: 'id3' } as UpdateCategoryDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('clears an existing parent when parentId is explicitly null (move to root)', async () => {
      const existing = makeCategory({ id: 'id1', parentId: 'root' });
      repo.findById.mockResolvedValue(existing);

      const result = await service.update('id1', {
        parentId: null,
      } as unknown as UpdateCategoryDto);

      expect(result.parentId).toBeNull();
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('leaves the parent untouched when parentId is omitted entirely', async () => {
      const existing = makeCategory({ id: 'id1', parentId: 'root' });
      repo.findById.mockResolvedValue(existing);

      const result = await service.update('id1', {
        name: 'Renamed',
      } as UpdateCategoryDto);

      expect(result.parentId).toBe('root');
    });

    it('clears existing SEO metadata when seo is explicitly null', async () => {
      const existing = makeCategory({
        id: 'id1',
        seo: { metaTitle: 'Old title' },
      });
      repo.findById.mockResolvedValue(existing);

      const result = await service.update('id1', {
        seo: null,
      } as unknown as UpdateCategoryDto);

      expect(result.seo).toBeNull();
    });

    it('leaves SEO metadata untouched when seo is omitted entirely', async () => {
      const existing = makeCategory({
        id: 'id1',
        seo: { metaTitle: 'Old title' },
      });
      repo.findById.mockResolvedValue(existing);

      const result = await service.update('id1', {
        name: 'Renamed',
      } as UpdateCategoryDto);

      expect(result.seo).toEqual({ metaTitle: 'Old title' });
    });
  });

  describe('reorder', () => {
    it('delegates the whole batch to the repository in a single call', async () => {
      const items = [
        { id: 'a', sortOrder: 0 },
        { id: 'b', sortOrder: 1 },
      ];

      await service.reorder({ items });

      expect(repo.reorder).toHaveBeenCalledTimes(1);
      expect(repo.reorder).toHaveBeenCalledWith(items);
    });
  });

  describe('remove', () => {
    it('throws 404 when the category does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('removes an existing category', async () => {
      const existing = makeCategory({ id: 'id1' });
      repo.findById.mockResolvedValue(existing);

      await service.remove('id1');

      expect(repo.remove).toHaveBeenCalledWith(existing);
    });
  });

  describe('findAll caching', () => {
    it('serves a second call from the in-memory cache (no second DB round-trip)', async () => {
      repo.findAll.mockResolvedValue([makeCategory()]);

      await service.findAll();
      await service.findAll();

      expect(repo.findAll).toHaveBeenCalledTimes(1);
    });

    it('invalidates the cache after create', async () => {
      repo.findAll.mockResolvedValue([makeCategory()]);
      repo.findBySlug.mockResolvedValue(null);

      await service.findAll();
      await service.create({ name: 'New', slug: 'new' } as CreateCategoryDto);
      await service.findAll();

      expect(repo.findAll).toHaveBeenCalledTimes(2);
    });

    it('invalidates the cache after update', async () => {
      repo.findAll.mockResolvedValue([makeCategory()]);
      repo.findById.mockResolvedValue(makeCategory({ id: 'id1' }));

      await service.findAll();
      await service.update('id1', { name: 'Renamed' } as UpdateCategoryDto);
      await service.findAll();

      expect(repo.findAll).toHaveBeenCalledTimes(2);
    });

    it('invalidates the cache after remove', async () => {
      repo.findAll.mockResolvedValue([makeCategory()]);
      repo.findById.mockResolvedValue(makeCategory({ id: 'id1' }));

      await service.findAll();
      await service.remove('id1');
      await service.findAll();

      expect(repo.findAll).toHaveBeenCalledTimes(2);
    });

    it('invalidates the cache after reorder', async () => {
      repo.findAll.mockResolvedValue([makeCategory()]);

      await service.findAll();
      await service.reorder({ items: [{ id: 'a', sortOrder: 0 }] });
      await service.findAll();

      expect(repo.findAll).toHaveBeenCalledTimes(2);
    });

    it('does not invalidate the cache when a write fails validation', async () => {
      repo.findAll.mockResolvedValue([makeCategory()]);
      repo.findBySlug.mockResolvedValue(makeCategory({ slug: 'dup' })); // conflict

      await service.findAll();
      await expect(
        service.create({ name: 'X', slug: 'dup' } as CreateCategoryDto),
      ).rejects.toThrow(ConflictException);
      await service.findAll();

      expect(repo.findAll).toHaveBeenCalledTimes(1);
    });
  });
});
