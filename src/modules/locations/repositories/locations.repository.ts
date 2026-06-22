import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Province } from '../entities/province.entity';
import { Ward } from '../entities/ward.entity';

@Injectable()
export class LocationsRepository {
  constructor(
    @InjectRepository(Province)
    private readonly provinces: Repository<Province>,
    @InjectRepository(Ward)
    private readonly wards: Repository<Ward>,
  ) {}

  findAllProvinces(): Promise<Province[]> {
    return this.provinces.find({ order: { name: 'ASC' } });
  }

  findProvince(code: number): Promise<Province | null> {
    return this.provinces.findOne({ where: { code } });
  }

  findWardsByProvince(provinceCode: number): Promise<Ward[]> {
    return this.wards.find({
      where: { provinceCode },
      order: { name: 'ASC' },
    });
  }

  findWard(code: number): Promise<Ward | null> {
    return this.wards.findOne({ where: { code } });
  }

  countProvinces(): Promise<number> {
    return this.provinces.count();
  }

  /** Bulk upsert by natural code key (idempotent sync). */
  async upsertProvinces(rows: Partial<Province>[]): Promise<void> {
    if (rows.length) await this.provinces.upsert(rows, ['code']);
  }

  async upsertWards(rows: Partial<Ward>[]): Promise<void> {
    // Chunk to keep parameter counts within Postgres limits.
    const size = 500;
    for (let i = 0; i < rows.length; i += size) {
      await this.wards.upsert(rows.slice(i, i + size), ['code']);
    }
  }
}
