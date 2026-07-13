import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryAttribute } from '../entities/category-attribute.entity';

@Injectable()
export class CategoryAttributesRepository {
  constructor(
    @InjectRepository(CategoryAttribute)
    private readonly repo: Repository<CategoryAttribute>,
  ) {}

  findByCategory(categoryId: string): Promise<CategoryAttribute[]> {
    return this.repo.find({
      where: { categoryId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  findById(id: string): Promise<CategoryAttribute | null> {
    return this.repo.findOne({ where: { id } });
  }

  /** How many attribute definitions already exist for this category — used
   *  to default a new one's `sortOrder` to "append at the end". */
  count(categoryId: string): Promise<number> {
    return this.repo.count({ where: { categoryId } });
  }

  create(data: Partial<CategoryAttribute>): CategoryAttribute {
    return this.repo.create(data);
  }

  save(attribute: CategoryAttribute): Promise<CategoryAttribute> {
    return this.repo.save(attribute);
  }

  remove(attribute: CategoryAttribute): Promise<CategoryAttribute> {
    return this.repo.remove(attribute);
  }
}
