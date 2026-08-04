import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedResult } from '../../../common/dto/paginated-result';
import { InventoryService } from '../../branches/services/inventory.service';
import { ProductsService } from '../../catalog/services/products.service';
import { AdminComboQueryDto } from '../dto/admin-combo-query.dto';
import { CreateComboDto, ComboItemInputDto } from '../dto/create-combo.dto';
import { UpdateComboDto } from '../dto/update-combo.dto';
import { Combo } from '../entities/combo.entity';
import { ComboItem } from '../entities/combo-item.entity';
import { CombosRepository } from '../repositories/combos.repository';
import { toComboView } from '../serializers/combo.serializer';

/** Bỏ dấu tiếng Việt + kebab-case cho slug. */
function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

@Injectable()
export class CombosService {
  constructor(
    private readonly combos: CombosRepository,
    private readonly products: ProductsService,
    private readonly inventory: InventoryService,
  ) {}

  // ── Admin CRUD ────────────────────────────────────────────────────
  async create(dto: CreateComboDto) {
    await this.validateItems(dto.items);
    const combo = this.combos.create({
      name: dto.name,
      slug: await this.resolveSlug(dto.slug ?? dto.name),
      description: dto.description,
      imageUrl: dto.imageUrl,
      price: dto.price,
      status: dto.status,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      items: dto.items.map((i) => this.toComboItem(i)),
    });
    const saved = await this.combos.save(combo);
    return this.viewOf(saved.id);
  }

  async update(id: string, dto: UpdateComboDto) {
    const combo = await this.getOrFail(id);
    if (dto.items) await this.validateItems(dto.items);

    if (dto.name !== undefined) combo.name = dto.name;
    if (dto.slug !== undefined)
      combo.slug = await this.resolveSlug(dto.slug, id);
    if (dto.description !== undefined) combo.description = dto.description;
    if (dto.imageUrl !== undefined) combo.imageUrl = dto.imageUrl;
    if (dto.price !== undefined) combo.price = dto.price;
    if (dto.status !== undefined) combo.status = dto.status;
    if (dto.startsAt !== undefined)
      combo.startsAt = dto.startsAt ? new Date(dto.startsAt) : undefined;
    if (dto.endsAt !== undefined)
      combo.endsAt = dto.endsAt ? new Date(dto.endsAt) : undefined;
    // Thay toàn bộ thành phần khi client gửi `items` (cascade lo xóa dòng cũ).
    if (dto.items) combo.items = dto.items.map((i) => this.toComboItem(i));

    await this.combos.save(combo);
    return this.viewOf(id);
  }

  async remove(id: string): Promise<void> {
    const combo = await this.getOrFail(id);
    await this.combos.remove(combo);
  }

  async findAllAdmin(query: AdminComboQueryDto) {
    const [rows, total] = await this.combos.searchAdmin(
      { status: query.status, q: query.q },
      query.skip,
      query.limit,
    );
    const availability = await this.availabilityMap(rows);
    const data = rows.map((c) => toComboView(c, availability.get(c.id) ?? 0));
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  findOneAdmin(id: string) {
    return this.viewOf(id);
  }

  // ── Public (storefront) ───────────────────────────────────────────
  async findPublicList() {
    const rows = await this.combos.findActive();
    const availability = await this.availabilityMap(rows);
    return rows.map((c) => toComboView(c, availability.get(c.id) ?? 0));
  }

  async findPublicBySlug(slug: string) {
    const combo = await this.combos.findBySlug(slug);
    if (!combo) throw new NotFoundException('Không tìm thấy combo');
    const [availability] = await this.availabilities([combo]);
    return toComboView(combo, availability);
  }

  // ── Helpers ───────────────────────────────────────────────────────
  private async viewOf(id: string) {
    const combo = await this.getOrFail(id);
    const [availability] = await this.availabilities([combo]);
    return toComboView(combo, availability);
  }

  private async getOrFail(id: string): Promise<Combo> {
    const combo = await this.combos.findById(id);
    if (!combo) throw new NotFoundException('Không tìm thấy combo');
    return combo;
  }

  private toComboItem(input: ComboItemInputDto): ComboItem {
    const item = new ComboItem();
    item.variantId = input.variantId;
    item.quantity = input.quantity;
    return item;
  }

  /** Thành phần phải là biến thể tồn tại + đang bán, không trùng nhau. */
  private async validateItems(items: ComboItemInputDto[]): Promise<void> {
    const ids = items.map((i) => i.variantId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Combo có biến thể bị trùng.');
    }
    for (const it of items) {
      const variant = await this.products.getVariantOrFail(it.variantId);
      if (!variant.isActive) {
        throw new BadRequestException(
          `Biến thể ${variant.sku} đang tắt — không thể thêm vào combo.`,
        );
      }
    }
  }

  private async resolveSlug(
    source: string,
    exceptId?: string,
  ): Promise<string> {
    const base = slugify(source) || 'combo';
    let slug = base;
    let n = 2;
    while (await this.combos.slugExists(slug, exceptId)) {
      slug = `${base}-${n++}`;
    }
    return slug;
  }

  /** Tồn khả dụng của một combo = min trên thành phần floor(available/qty).
   *  `available` của một variant = tổng (quantity − reserved) qua các chi nhánh. */
  private async availabilities(combos: Combo[]): Promise<number[]> {
    const variantIds = [
      ...new Set(
        combos.flatMap((c) => (c.items ?? []).map((i) => i.variantId)),
      ),
    ];
    const rows = await this.inventory.findForVariants(variantIds);
    const availByVariant = new Map<string, number>();
    for (const r of rows) {
      const prev = availByVariant.get(r.variantId) ?? 0;
      availByVariant.set(
        r.variantId,
        prev + Math.max(0, r.quantity - r.reserved),
      );
    }
    return combos.map((c) => {
      const items = c.items ?? [];
      if (!items.length) return 0;
      return Math.min(
        ...items.map((it) =>
          Math.floor((availByVariant.get(it.variantId) ?? 0) / it.quantity),
        ),
      );
    });
  }

  private async availabilityMap(combos: Combo[]): Promise<Map<string, number>> {
    const values = await this.availabilities(combos);
    return new Map(combos.map((c, i) => [c.id, values[i] ?? 0]));
  }
}
