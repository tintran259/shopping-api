import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { ComboStatus } from '../../../common/enums';
import { Combo } from '../entities/combo.entity';

/** Quan hệ cần để hiển thị/định giá/tính tồn một combo. */
const COMBO_RELATIONS = {
  items: { variant: { product: { images: true } } },
} as const;

@Injectable()
export class CombosRepository {
  constructor(
    @InjectRepository(Combo)
    private readonly repo: Repository<Combo>,
  ) {}

  create(data: Partial<Combo>): Combo {
    return this.repo.create(data);
  }

  save(combo: Combo): Promise<Combo> {
    return this.repo.save(combo);
  }

  remove(combo: Combo): Promise<Combo> {
    return this.repo.remove(combo);
  }

  findById(id: string): Promise<Combo | null> {
    return this.repo.findOne({ where: { id }, relations: COMBO_RELATIONS });
  }

  findBySlug(slug: string): Promise<Combo | null> {
    return this.repo.findOne({ where: { slug }, relations: COMBO_RELATIONS });
  }

  async slugExists(slug: string, exceptId?: string): Promise<boolean> {
    const count = await this.repo.count({
      where: exceptId ? { slug, id: Not(exceptId) } : { slug },
    });
    return count > 0;
  }

  /** Danh sách admin: lọc trạng thái + tìm theo tên, phân trang, kèm thành phần. */
  searchAdmin(
    filters: { status?: ComboStatus; q?: string },
    skip: number,
    take: number,
  ): Promise<[Combo[], number]> {
    const qb = this.repo
      .createQueryBuilder('combo')
      .leftJoinAndSelect('combo.items', 'item')
      .leftJoinAndSelect('item.variant', 'variant')
      .leftJoinAndSelect('variant.product', 'product')
      .orderBy('combo.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    if (filters.status) {
      qb.andWhere('combo.status = :status', { status: filters.status });
    }
    if (filters.q) {
      qb.andWhere('combo.name ILIKE :q', { q: `%${filters.q}%` });
    }
    return qb.getManyAndCount();
  }

  /** Combo đang bán (storefront). */
  findActive(): Promise<Combo[]> {
    return this.repo.find({
      where: { status: ComboStatus.ACTIVE },
      relations: COMBO_RELATIONS,
      order: { createdAt: 'DESC' },
    });
  }
}
