import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoryAttributeType } from '../../../common/enums';
import {
  CreateCategoryAttributeDto,
  UpdateCategoryAttributeDto,
} from '../dto/category-attribute.dto';
import { CategoryAttribute } from '../entities/category-attribute.entity';
import { CategoriesRepository } from '../repositories/categories.repository';
import { CategoryAttributesRepository } from '../repositories/category-attributes.repository';

const OPTIONS_TYPES = new Set([
  CategoryAttributeType.SELECT,
  CategoryAttributeType.MULTISELECT,
]);

@Injectable()
export class CategoryAttributesService {
  constructor(
    private readonly attributes: CategoryAttributesRepository,
    private readonly categories: CategoriesRepository,
  ) {}

  async findByCategory(categoryId: string): Promise<CategoryAttribute[]> {
    await this.assertCategoryExists(categoryId);
    return this.attributes.findByCategory(categoryId);
  }

  async create(
    categoryId: string,
    dto: CreateCategoryAttributeDto,
  ): Promise<CategoryAttribute> {
    await this.assertCategoryExists(categoryId);
    this.assertOptionsMatchType(dto.type, dto.options);

    const sortOrder =
      dto.sortOrder ?? (await this.attributes.count(categoryId));
    return this.attributes.save(
      this.attributes.create({ ...dto, categoryId, sortOrder }),
    );
  }

  async update(
    categoryId: string,
    id: string,
    dto: UpdateCategoryAttributeDto,
  ): Promise<CategoryAttribute> {
    const attribute = await this.findOwned(categoryId, id);
    const effectiveType = dto.type ?? attribute.type;
    const effectiveOptions =
      dto.options !== undefined ? dto.options : attribute.options;
    this.assertOptionsMatchType(effectiveType, effectiveOptions);

    Object.assign(attribute, dto);
    return this.attributes.save(attribute);
  }

  async remove(categoryId: string, id: string): Promise<void> {
    const attribute = await this.findOwned(categoryId, id);
    await this.attributes.remove(attribute);
  }

  /** 404s if the attribute doesn't exist *or* belongs to a different
   *  category — the URL nests `:categoryId/attributes/:id`, so a mismatch
   *  means the caller is pointing at the wrong parent. */
  private async findOwned(
    categoryId: string,
    id: string,
  ): Promise<CategoryAttribute> {
    const attribute = await this.attributes.findById(id);
    if (!attribute || attribute.categoryId !== categoryId) {
      throw new NotFoundException('Category attribute not found');
    }
    return attribute;
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.categories.findById(categoryId);
    if (!category) throw new NotFoundException('Category not found');
  }

  private assertOptionsMatchType(
    type: CategoryAttributeType,
    options: string[] | undefined,
  ): void {
    if (OPTIONS_TYPES.has(type) && !options?.length) {
      throw new BadRequestException(
        'Thuộc tính kiểu chọn (select/multiselect) cần ít nhất 1 tùy chọn',
      );
    }
  }
}
