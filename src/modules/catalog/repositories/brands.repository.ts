import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brand } from '../entities/brand.entity';

@Injectable()
export class BrandsRepository {
  constructor(
    @InjectRepository(Brand)
    private readonly repo: Repository<Brand>,
  ) {}

  create(data: Partial<Brand>): Brand {
    return this.repo.create(data);
  }

  save(brand: Brand): Promise<Brand> {
    return this.repo.save(brand);
  }

  remove(brand: Brand): Promise<Brand> {
    return this.repo.remove(brand);
  }

  findAll(): Promise<Brand[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<Brand | null> {
    return this.repo.findOne({ where: { id } });
  }

  findBySlug(slug: string): Promise<Brand | null> {
    return this.repo.findOne({ where: { slug } });
  }
}
