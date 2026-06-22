import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBrandDto, UpdateBrandDto } from '../dto/brand.dto';
import { Brand } from '../entities/brand.entity';
import { BrandsRepository } from '../repositories/brands.repository';

@Injectable()
export class BrandsService {
  constructor(private readonly brands: BrandsRepository) {}

  findAll(): Promise<Brand[]> {
    return this.brands.findAll();
  }

  async findOne(id: string): Promise<Brand> {
    const brand = await this.brands.findById(id);
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async create(dto: CreateBrandDto): Promise<Brand> {
    if (await this.brands.findBySlug(dto.slug)) {
      throw new ConflictException('Brand slug already in use');
    }
    return this.brands.save(this.brands.create(dto));
  }

  async update(id: string, dto: UpdateBrandDto): Promise<Brand> {
    const brand = await this.findOne(id);
    Object.assign(brand, dto);
    return this.brands.save(brand);
  }

  async remove(id: string): Promise<void> {
    await this.brands.remove(await this.findOne(id));
  }
}
