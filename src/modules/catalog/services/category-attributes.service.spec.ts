import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CategoryAttributeType } from '../../../common/enums';
import { CategoryAttributesService } from './category-attributes.service';
import { CategoriesRepository } from '../repositories/categories.repository';
import { CategoryAttributesRepository } from '../repositories/category-attributes.repository';
import { CategoryAttribute } from '../entities/category-attribute.entity';
import { Category } from '../entities/category.entity';
import {
  CreateCategoryAttributeDto,
  UpdateCategoryAttributeDto,
} from '../dto/category-attribute.dto';

function makeAttribute(
  overrides: Partial<CategoryAttribute> = {},
): CategoryAttribute {
  return {
    id: 'attr-id',
    categoryId: 'cat-id',
    name: 'Size',
    type: CategoryAttributeType.TEXT,
    isRequired: false,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CategoryAttribute;
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-id',
    name: 'Category',
    slug: 'category',
    ...overrides,
  } as Category;
}

describe('CategoryAttributesService', () => {
  let service: CategoryAttributesService;
  let attributes: { [K in keyof CategoryAttributesRepository]: jest.Mock };
  let categories: { findById: jest.Mock };

  beforeEach(async () => {
    attributes = {
      findByCategory: jest.fn(),
      findById: jest.fn(),
      count: jest.fn(),
      create: jest.fn(
        (data: Partial<CategoryAttribute>) => data as CategoryAttribute,
      ),
      save: jest.fn(async (a: CategoryAttribute) => a),
      remove: jest.fn(async (a: CategoryAttribute) => a),
    };
    categories = { findById: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        CategoryAttributesService,
        { provide: CategoryAttributesRepository, useValue: attributes },
        { provide: CategoriesRepository, useValue: categories },
      ],
    }).compile();

    service = module.get(CategoryAttributesService);
  });

  describe('findByCategory', () => {
    it('throws 404 when the category does not exist', async () => {
      categories.findById.mockResolvedValue(null);
      await expect(service.findByCategory('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the category’s attribute definitions', async () => {
      categories.findById.mockResolvedValue(makeCategory());
      attributes.findByCategory.mockResolvedValue([makeAttribute()]);
      await expect(service.findByCategory('cat-id')).resolves.toHaveLength(1);
    });
  });

  describe('create', () => {
    it('throws 404 when the category does not exist', async () => {
      categories.findById.mockResolvedValue(null);
      await expect(
        service.create('missing', {
          name: 'Size',
          type: CategoryAttributeType.TEXT,
        } as CreateCategoryAttributeDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a SELECT type with no options', async () => {
      categories.findById.mockResolvedValue(makeCategory());
      await expect(
        service.create('cat-id', {
          name: 'Size',
          type: CategoryAttributeType.SELECT,
        } as CreateCategoryAttributeDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a MULTISELECT type with an empty options array', async () => {
      categories.findById.mockResolvedValue(makeCategory());
      await expect(
        service.create('cat-id', {
          name: 'Size',
          type: CategoryAttributeType.MULTISELECT,
          options: [],
        } as CreateCategoryAttributeDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a SELECT type with options', async () => {
      categories.findById.mockResolvedValue(makeCategory());
      attributes.count.mockResolvedValue(0);
      const result = await service.create('cat-id', {
        name: 'Size',
        type: CategoryAttributeType.SELECT,
        options: ['S', 'M', 'L'],
      } as CreateCategoryAttributeDto);
      expect(result.options).toEqual(['S', 'M', 'L']);
    });

    it('accepts a TEXT type with no options', async () => {
      categories.findById.mockResolvedValue(makeCategory());
      attributes.count.mockResolvedValue(0);
      await expect(
        service.create('cat-id', {
          name: 'Material',
          type: CategoryAttributeType.TEXT,
        } as CreateCategoryAttributeDto),
      ).resolves.toBeDefined();
    });

    it('defaults sortOrder to the current count (append at the end)', async () => {
      categories.findById.mockResolvedValue(makeCategory());
      attributes.count.mockResolvedValue(3);
      const result = await service.create('cat-id', {
        name: 'Material',
        type: CategoryAttributeType.TEXT,
      } as CreateCategoryAttributeDto);
      expect(result.sortOrder).toBe(3);
    });

    it('respects an explicit sortOrder over the default', async () => {
      categories.findById.mockResolvedValue(makeCategory());
      attributes.count.mockResolvedValue(3);
      const result = await service.create('cat-id', {
        name: 'Material',
        type: CategoryAttributeType.TEXT,
        sortOrder: 0,
      } as CreateCategoryAttributeDto);
      expect(result.sortOrder).toBe(0);
    });
  });

  describe('update', () => {
    it('throws 404 when the attribute does not exist', async () => {
      attributes.findById.mockResolvedValue(null);
      await expect(
        service.update('cat-id', 'missing', {} as UpdateCategoryAttributeDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when the attribute belongs to a different category', async () => {
      attributes.findById.mockResolvedValue(
        makeAttribute({ categoryId: 'other-cat' }),
      );
      await expect(
        service.update('cat-id', 'attr-id', {} as UpdateCategoryAttributeDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects switching to SELECT without also providing options', async () => {
      attributes.findById.mockResolvedValue(
        makeAttribute({ type: CategoryAttributeType.TEXT, options: undefined }),
      );
      await expect(
        service.update('cat-id', 'attr-id', {
          type: CategoryAttributeType.SELECT,
        } as UpdateCategoryAttributeDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows switching to SELECT when options are provided in the same request', async () => {
      attributes.findById.mockResolvedValue(
        makeAttribute({ type: CategoryAttributeType.TEXT, options: undefined }),
      );
      await expect(
        service.update('cat-id', 'attr-id', {
          type: CategoryAttributeType.SELECT,
          options: ['S', 'M'],
        } as UpdateCategoryAttributeDto),
      ).resolves.toBeDefined();
    });

    it('keeps validating against existing options when only the name changes', async () => {
      attributes.findById.mockResolvedValue(
        makeAttribute({
          type: CategoryAttributeType.SELECT,
          options: ['S', 'M'],
        }),
      );
      const result = await service.update('cat-id', 'attr-id', {
        name: 'Renamed',
      } as UpdateCategoryAttributeDto);
      expect(result.name).toBe('Renamed');
      expect(result.options).toEqual(['S', 'M']);
    });
  });

  describe('remove', () => {
    it('throws 404 when the attribute belongs to a different category', async () => {
      attributes.findById.mockResolvedValue(
        makeAttribute({ categoryId: 'other-cat' }),
      );
      await expect(service.remove('cat-id', 'attr-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('removes an owned attribute', async () => {
      const attr = makeAttribute();
      attributes.findById.mockResolvedValue(attr);
      await service.remove('cat-id', 'attr-id');
      expect(attributes.remove).toHaveBeenCalledWith(attr);
    });
  });
});
