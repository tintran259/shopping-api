import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Category } from '../entities/category.entity';

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

  findAll(): Promise<Category[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
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
}
