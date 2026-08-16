import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { ComboStatus } from '../../../common/enums';
import { ComboItem } from '../entities/combo-item.entity';
import { Combo } from '../entities/combo.entity';

/** Quan hệ cần để hiển thị/định giá/tính tồn một combo. */
const COMBO_RELATIONS = {
  items: { variant: { product: { images: true } } },
  branch: true,
} as const;

@Injectable()
export class CombosRepository {
  constructor(
    @InjectRepository(Combo)
    private readonly repo: Repository<Combo>,
    @InjectRepository(ComboItem)
    private readonly itemsRepo: Repository<ComboItem>,
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

  /** Combo không kèm thành phần — dùng cho update scalar (tránh cascade nullify). */
  findBasic(id: string): Promise<Combo | null> {
    return this.repo.findOne({ where: { id } });
  }

  /** Thay TOÀN BỘ thành phần của combo (xóa cũ + chèn mới) trong 1 transaction. */
  async replaceItems(
    comboId: string,
    items: { variantId: string; quantity: number }[],
  ): Promise<void> {
    await this.repo.manager.transaction(async (m) => {
      await m.delete(ComboItem, { comboId });
      await m.save(
        items.map((i) =>
          m.create(ComboItem, {
            comboId,
            variantId: i.variantId,
            quantity: i.quantity,
          }),
        ),
      );
    });
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
      .leftJoinAndSelect('combo.branch', 'branch')
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

  /**
   * Combo đang bán cho storefront: active + trong khoảng lịch (startsAt..endsAt),
   * phân trang. Lọc theo chi nhánh khi truyền `branchId` — gồm cả combo áp dụng
   * mọi chi nhánh (`branch_id IS NULL`), vì combo toàn hệ thống cũng bán ở chi
   * nhánh đó. Lịch được lọc ngay trong SQL để `total` khớp đúng số combo trả về.
   */
  findPublic(
    filters: { branchId?: string },
    skip: number,
    take: number,
  ): Promise<[Combo[], number]> {
    const now = new Date();
    const qb = this.repo
      .createQueryBuilder('combo')
      .leftJoinAndSelect('combo.items', 'item')
      .leftJoinAndSelect('item.variant', 'variant')
      .leftJoinAndSelect('variant.product', 'product')
      .leftJoinAndSelect('product.images', 'image')
      .leftJoinAndSelect('combo.branch', 'branch')
      .where('combo.status = :status', { status: ComboStatus.ACTIVE })
      .andWhere('(combo.startsAt IS NULL OR combo.startsAt <= :now)', { now })
      .andWhere('(combo.endsAt IS NULL OR combo.endsAt >= :now)', { now })
      .orderBy('combo.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    if (filters.branchId) {
      qb.andWhere(
        '(combo.branchId = :branchId OR combo.branchId IS NULL)',
        { branchId: filters.branchId },
      );
    }

    return qb.getManyAndCount();
  }
}
