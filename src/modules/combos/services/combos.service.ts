import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isBranchAllowed,
  type BranchScopeCtx,
} from '../../../common/decorators/branch-scope.decorator';
import { PaginatedResult } from '../../../common/dto/paginated-result';
import { BranchesService } from '../../branches/services/branches.service';
import { InventoryService } from '../../branches/services/inventory.service';
import { ProductsService } from '../../catalog/services/products.service';
import type { OrderLineItem } from '../../orders/services/orders.service';
import { AdminComboQueryDto } from '../dto/admin-combo-query.dto';
import { CreateComboDto, ComboItemInputDto } from '../dto/create-combo.dto';
import { PublicComboQueryDto } from '../dto/public-combo-query.dto';
import { UpdateComboDto } from '../dto/update-combo.dto';
import { Combo } from '../entities/combo.entity';
import { ComboItem } from '../entities/combo-item.entity';
import { CombosRepository } from '../repositories/combos.repository';
import { isComboSellable, toComboView } from '../serializers/combo.serializer';

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
    private readonly branches: BranchesService,
  ) {}

  // ── Admin CRUD ────────────────────────────────────────────────────
  async create(dto: CreateComboDto, scope: BranchScopeCtx) {
    await this.validateItems(dto.items);
    await this.assertBranchAccess(dto.branchId, scope);
    const combo = this.combos.create({
      name: dto.name,
      slug: await this.resolveSlug(dto.slug ?? dto.name),
      description: dto.description,
      imageUrl: dto.imageUrl,
      price: dto.price,
      status: dto.status,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      branchId: dto.branchId ?? null,
      items: dto.items.map((i) => this.toComboItem(i)),
    });
    const saved = await this.combos.save(combo);
    return this.viewOf(saved.id);
  }

  async update(id: string, dto: UpdateComboDto, scope: BranchScopeCtx) {
    // Nạp KHÔNG kèm items → save chỉ đụng scalar (không cascade nullify item cũ).
    const combo = await this.combos.findBasic(id);
    if (!combo) throw new NotFoundException('Không tìm thấy combo');
    // Không cho sửa combo đang thuộc chi nhánh ngoài phạm vi của tài khoản.
    if (combo.branchId && !isBranchAllowed(scope, combo.branchId)) {
      throw new ForbiddenException(
        'Bạn không có quyền với chi nhánh của combo này.',
      );
    }
    if (dto.items) await this.validateItems(dto.items);
    if (dto.branchId !== undefined)
      await this.assertBranchAccess(dto.branchId, scope);

    if (dto.name !== undefined) combo.name = dto.name;
    if (dto.slug !== undefined)
      combo.slug = await this.resolveSlug(dto.slug, id);
    if (dto.description !== undefined) combo.description = dto.description;
    if (dto.imageUrl !== undefined) combo.imageUrl = dto.imageUrl;
    if (dto.price !== undefined) combo.price = dto.price;
    if (dto.status !== undefined) combo.status = dto.status;
    // Gửi null/'' ⇒ xóa mốc (null clear cột; undefined = giữ nguyên).
    if (dto.startsAt !== undefined)
      combo.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined)
      combo.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    // Gửi null/'' ⇒ gỡ ràng buộc chi nhánh (bán/tính tồn mọi chi nhánh).
    if (dto.branchId !== undefined) combo.branchId = dto.branchId || null;

    await this.combos.save(combo);
    // Thay toàn bộ thành phần: xóa cũ + chèn mới (tường minh, có transaction).
    if (dto.items) {
      await this.combos.replaceItems(
        id,
        dto.items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      );
    }
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

  /** View combo (giá/tồn/tiết kiệm/status) cho giỏ hàng. */
  getView(id: string) {
    return this.viewOf(id);
  }

  // ── Public (storefront) ───────────────────────────────────────────
  /** Danh sách combo đang bán, phân trang + lọc theo chi nhánh. Khi lọc theo
   *  `branchId`, tồn khả dụng của combo toàn hệ thống (branchId null) cũng được
   *  tính đúng trên chi nhánh đó. */
  async findPublicList(query: PublicComboQueryDto) {
    const [rows, total] = await this.combos.findPublic(
      { branchId: query.branchId },
      query.skip,
      query.limit,
    );
    const availability = await this.availabilityMap(rows, query.branchId);
    const data = rows.map((c) => toComboView(c, availability.get(c.id) ?? 0));
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async findPublicBySlug(slug: string) {
    const combo = await this.combos.findBySlug(slug);
    if (!combo || !isComboSellable(combo)) {
      throw new NotFoundException('Không tìm thấy combo');
    }
    const [availability] = await this.availabilities([combo]);
    return toComboView(combo, availability);
  }

  // ── Tích hợp đặt đơn ──────────────────────────────────────────────
  /**
   * "Nở" một combo (× `comboQty`) thành các dòng đơn hàng thành phần. Giá cố
   * định của combo được **phân bổ** về từng dòng theo tỉ trọng giá lẻ, làm tròn
   * và dồn phần dư vào dòng cuối để tổng khớp `price × comboQty`. Kho được giữ
   * theo từng variant thành phần ở `placeOrder` (không xử ở đây).
   */
  async resolveComboLineItems(
    comboId: string,
    comboQty: number,
  ): Promise<OrderLineItem[]> {
    const combo = await this.combos.findById(comboId);
    if (!combo) throw new NotFoundException('Combo không tồn tại');
    if (!isComboSellable(combo)) {
      throw new BadRequestException(
        'Combo hiện không bán (ngoài lịch hoặc đã tắt).',
      );
    }

    const round2 = (n: number): number => Math.round(n * 100) / 100;
    const comboPrice = Number(combo.price);
    const comps = combo.items;
    const weights = comps.map(
      (c) => Number(c.variant?.price ?? 0) * c.quantity,
    );
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

    let allocated = 0; // tổng đã phân bổ cho MỘT combo (dồn dư vào dòng cuối)
    return comps.map((c, i) => {
      const isLast = i === comps.length - 1;
      const share = isLast
        ? round2(comboPrice - allocated)
        : round2((comboPrice * weights[i]) / totalWeight);
      if (!isLast) allocated = round2(allocated + share);
      const unitPrice = round2(share / c.quantity);
      const variant = c.variant;
      const product = variant?.product;
      const imageUrl =
        variant?.imageUrl ??
        product?.images?.find((img) => img.isPrimary)?.url ??
        product?.images?.[0]?.url;
      return {
        variantId: c.variantId,
        productId: variant?.productId ?? '',
        productSlug: product?.slug ?? '',
        productName: product?.name ?? variant?.sku ?? 'Item',
        variantTitle: '',
        sku: variant?.sku ?? '',
        unitPrice: unitPrice.toFixed(2),
        quantity: c.quantity * comboQty,
        imageUrl,
        comboId: combo.id,
        comboName: combo.name,
      };
    });
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

  /** Chi nhánh phải tồn tại **và** nằm trong phạm vi của tài khoản. Combo không
   *  gắn chi nhánh (null = mọi chi nhánh) chỉ tài khoản toàn quyền mới đặt được. */
  private async assertBranchAccess(
    branchId: string | null | undefined,
    scope: BranchScopeCtx,
  ): Promise<void> {
    if (!branchId) {
      if (!scope.allBranches) {
        throw new ForbiddenException('Bạn phải chọn một chi nhánh được phép.');
      }
      return;
    }
    await this.branches.findOne(branchId); // tồn tại?
    if (!isBranchAllowed(scope, branchId)) {
      throw new ForbiddenException('Bạn không có quyền với chi nhánh này.');
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
   *  `available` của một variant = (quantity − reserved). Chi nhánh hiệu lực của
   *  một combo = `combo.branchId ?? branchId` (tham số ghi đè khi đang lọc danh
   *  sách theo chi nhánh): có chi nhánh ⇒ chỉ tính trên chi nhánh đó, không ⇒
   *  tính tổng qua mọi chi nhánh. */
  private async availabilities(
    combos: Combo[],
    branchId?: string,
  ): Promise<number[]> {
    const variantIds = [
      ...new Set(
        combos.flatMap((c) => (c.items ?? []).map((i) => i.variantId)),
      ),
    ];
    const rows = await this.inventory.findForVariants(variantIds);
    const totalByVariant = new Map<string, number>();
    const byBranchVariant = new Map<string, number>();
    for (const r of rows) {
      const avail = Math.max(0, r.quantity - r.reserved);
      totalByVariant.set(
        r.variantId,
        (totalByVariant.get(r.variantId) ?? 0) + avail,
      );
      const key = `${r.branchId}:${r.variantId}`;
      byBranchVariant.set(key, (byBranchVariant.get(key) ?? 0) + avail);
    }
    return combos.map((c) => {
      const items = c.items ?? [];
      if (!items.length) return 0;
      const effBranch = c.branchId ?? branchId;
      const availOf = (variantId: string): number =>
        effBranch
          ? (byBranchVariant.get(`${effBranch}:${variantId}`) ?? 0)
          : (totalByVariant.get(variantId) ?? 0);
      return Math.min(
        ...items.map((it) => Math.floor(availOf(it.variantId) / it.quantity)),
      );
    });
  }

  private async availabilityMap(
    combos: Combo[],
    branchId?: string,
  ): Promise<Map<string, number>> {
    const values = await this.availabilities(combos, branchId);
    return new Map(combos.map((c, i) => [c.id, values[i] ?? 0]));
  }
}
