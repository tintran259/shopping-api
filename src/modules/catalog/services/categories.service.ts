import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/category.dto';
import { Category } from '../entities/category.entity';
import { CategoriesRepository } from '../repositories/categories.repository';

@Injectable()
export class CategoriesService {
  constructor(private readonly categories: CategoriesRepository) {}

  findAll(): Promise<Category[]> {
    return this.categories.findAll();
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categories.findById(id);
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    await this.assertSlugFree(dto.slug);
    return this.categories.save(this.categories.create(dto));
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    if (dto.slug && dto.slug !== category.slug) {
      await this.assertSlugFree(dto.slug);
    }
    Object.assign(category, dto);
    return this.categories.save(category);
  }

  async remove(id: string): Promise<void> {
    await this.categories.remove(await this.findOne(id));
  }

  private async assertSlugFree(slug: string): Promise<void> {
    if (await this.categories.findBySlug(slug)) {
      throw new ConflictException('Category slug already in use');
    }
  }
}
