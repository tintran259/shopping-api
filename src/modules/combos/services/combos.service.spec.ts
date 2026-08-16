import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ComboStatus } from '../../../common/enums';
import type { BranchScopeCtx } from '../../../common/decorators/branch-scope.decorator';
import { BranchesService } from '../../branches/services/branches.service';
import { InventoryService } from '../../branches/services/inventory.service';
import { ProductsService } from '../../catalog/services/products.service';
import { CreateComboDto } from '../dto/create-combo.dto';
import { UpdateComboDto } from '../dto/update-combo.dto';
import { Combo } from '../entities/combo.entity';
import { CombosRepository } from '../repositories/combos.repository';
import { CombosService } from './combos.service';

/** Một thành phần combo (kèm `variant` đã nạp để serializer/định giá dùng). */
function item(variantId: string, quantity: number, price = '50') {
  return {
    variantId,
    quantity,
    variant: {
      id: variantId,
      sku: `SKU-${variantId}`,
      price,
      productId: 'p1',
      product: { id: 'p1', name: 'Sản phẩm', slug: 'san-pham', images: [] },
    },
  };
}

function makeCombo(overrides: Partial<Combo> = {}): Combo {
  return {
    id: 'c1',
    slug: 'combo',
    name: 'Combo',
    description: null,
    imageUrl: null,
    price: '100',
    status: ComboStatus.ACTIVE,
    startsAt: null,
    endsAt: null,
    branchId: null,
    branch: null,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Combo;
}

/** Một dòng tồn (branch × variant). */
function stock(
  branchId: string,
  variantId: string,
  quantity: number,
  reserved = 0,
) {
  return { branchId, variantId, quantity, reserved };
}

const ALL_BRANCHES: BranchScopeCtx = { allBranches: true, branchIds: [] };
const scopeOf = (...branchIds: string[]): BranchScopeCtx => ({
  allBranches: false,
  branchIds,
});

type MockRepo = { [K in keyof CombosRepository]: jest.Mock };

describe('CombosService', () => {
  let service: CombosService;
  let repo: MockRepo;
  let products: { getVariantOrFail: jest.Mock };
  let inventory: { findForVariants: jest.Mock };
  let branches: { findOne: jest.Mock };

  beforeEach(async () => {
    const mockRepo: MockRepo = {
      create: jest.fn((d: Partial<Combo>) => d as Combo),
      save: jest.fn(async (c: Combo) => ({ ...c, id: c.id ?? 'new-id' })),
      remove: jest.fn(async (c: Combo) => c),
      findById: jest.fn(),
      findBasic: jest.fn(),
      findBySlug: jest.fn(),
      slugExists: jest.fn(async () => false),
      replaceItems: jest.fn(async () => undefined),
      searchAdmin: jest.fn(),
      findPublic: jest.fn(),
    } as unknown as MockRepo;

    products = { getVariantOrFail: jest.fn(async () => ({ isActive: true })) };
    inventory = { findForVariants: jest.fn(async () => []) };
    branches = { findOne: jest.fn(async (id: string) => ({ id, name: 'CN' })) };

    const module = await Test.createTestingModule({
      providers: [
        CombosService,
        { provide: CombosRepository, useValue: mockRepo },
        { provide: ProductsService, useValue: products },
        { provide: InventoryService, useValue: inventory },
        { provide: BranchesService, useValue: branches },
      ],
    }).compile();

    service = module.get(CombosService);
    repo = module.get(CombosRepository);
  });

  // ── Tồn khả dụng theo chi nhánh ─────────────────────────────────────
  describe('availability (branch scope)', () => {
    it('combo gắn chi nhánh chỉ tính tồn của chi nhánh đó', async () => {
      repo.findById.mockResolvedValue(
        makeCombo({ branchId: 'B1', items: [item('v1', 2)] as never }),
      );
      inventory.findForVariants.mockResolvedValue([
        stock('B1', 'v1', 10, 1), // available 9 → floor(9/2)=4
        stock('B2', 'v1', 100, 0), // chi nhánh khác — bỏ qua
      ]);

      const view = await service.findOneAdmin('c1');

      expect(view.availability).toBe(4);
    });

    it('combo không gắn chi nhánh cộng tồn qua mọi chi nhánh', async () => {
      repo.findById.mockResolvedValue(
        makeCombo({ branchId: null, items: [item('v1', 2)] as never }),
      );
      inventory.findForVariants.mockResolvedValue([
        stock('B1', 'v1', 10, 1), // 9
        stock('B2', 'v1', 100, 0), // 100  → tổng 109 → floor(109/2)=54
      ]);

      const view = await service.findOneAdmin('c1');

      expect(view.availability).toBe(54);
    });

    it('tồn combo = min floor(tồn/qty) qua các thành phần', async () => {
      repo.findById.mockResolvedValue(
        makeCombo({
          branchId: 'B1',
          items: [item('v1', 2), item('v2', 1)] as never,
        }),
      );
      inventory.findForVariants.mockResolvedValue([
        stock('B1', 'v1', 10, 0), // floor(10/2)=5
        stock('B1', 'v2', 3, 0), // floor(3/1)=3  → min=3
      ]);

      const view = await service.findOneAdmin('c1');

      expect(view.availability).toBe(3);
    });

    it('thiếu tồn một thành phần ⇒ combo hết hàng (0)', async () => {
      repo.findById.mockResolvedValue(
        makeCombo({
          branchId: 'B1',
          items: [item('v1', 1), item('v2', 1)] as never,
        }),
      );
      inventory.findForVariants.mockResolvedValue([
        stock('B1', 'v1', 5, 0),
        stock('B1', 'v2', 0, 0), // hết
      ]);

      const view = await service.findOneAdmin('c1');

      expect(view.availability).toBe(0);
    });
  });

  // ── Danh sách công khai (phân trang + theo chi nhánh) ───────────────
  describe('findPublicList', () => {
    it('trả PaginatedResult với meta đúng và truyền branchId xuống repo', async () => {
      const combo = makeCombo({ branchId: null, items: [item('v1', 1)] as never });
      repo.findPublic.mockResolvedValue([[combo], 1]);
      inventory.findForVariants.mockResolvedValue([stock('B1', 'v1', 3, 0)]);

      const res = await service.findPublicList({
        page: 1,
        limit: 20,
        branchId: 'B1',
        skip: 0,
      } as never);

      expect(repo.findPublic).toHaveBeenCalledWith({ branchId: 'B1' }, 0, 20);
      expect(res.meta).toEqual({ total: 1, page: 1, limit: 20, pageCount: 1 });
      expect(res.data).toHaveLength(1);
    });

    it('combo toàn hệ thống được tính tồn theo chi nhánh đang lọc', async () => {
      const combo = makeCombo({ branchId: null, items: [item('v1', 2)] as never });
      repo.findPublic.mockResolvedValue([[combo], 1]);
      inventory.findForVariants.mockResolvedValue([
        stock('B1', 'v1', 10, 0), // floor(10/2)=5 tại B1
        stock('B2', 'v1', 100, 0), // chi nhánh khác — KHÔNG cộng khi lọc B1
      ]);

      const res = await service.findPublicList({
        page: 1,
        limit: 20,
        branchId: 'B1',
        skip: 0,
      } as never);

      expect(res.data[0].availability).toBe(5);
    });
  });

  // ── Phân quyền chi nhánh khi tạo ────────────────────────────────────
  describe('create — branch scope', () => {
    const dto = (branchId?: string | null): CreateComboDto =>
      ({
        name: 'C',
        price: '100',
        items: [{ variantId: 'v1', quantity: 1 }],
        branchId,
      }) as CreateComboDto;

    beforeEach(() => {
      repo.findById.mockResolvedValue(
        makeCombo({ items: [item('v1', 1)] as never }),
      );
    });

    it('cho phép tài khoản toàn quyền tạo combo không gắn chi nhánh', async () => {
      await expect(
        service.create(dto(null), ALL_BRANCHES),
      ).resolves.toBeDefined();
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('chặn tài khoản branch-scoped tạo combo không gắn chi nhánh', async () => {
      await expect(service.create(dto(null), scopeOf('B1'))).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('chặn tạo combo cho chi nhánh ngoài phạm vi', async () => {
      await expect(service.create(dto('B2'), scopeOf('B1'))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('cho phép tạo combo cho chi nhánh trong phạm vi', async () => {
      await expect(
        service.create(dto('B1'), scopeOf('B1')),
      ).resolves.toBeDefined();
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 'B1' }),
      );
    });
  });

  // ── Phân quyền chi nhánh khi sửa ────────────────────────────────────
  describe('update — branch scope', () => {
    it('chặn sửa combo đang thuộc chi nhánh ngoài phạm vi', async () => {
      repo.findBasic.mockResolvedValue(makeCombo({ branchId: 'B2' }));
      await expect(
        service.update('c1', { name: 'X' } as UpdateComboDto, scopeOf('B1')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('chặn chuyển combo sang chi nhánh ngoài phạm vi', async () => {
      repo.findBasic.mockResolvedValue(makeCombo({ branchId: 'B1' }));
      repo.findById.mockResolvedValue(makeCombo({ branchId: 'B1' }));
      await expect(
        service.update(
          'c1',
          { branchId: 'B2' } as UpdateComboDto,
          scopeOf('B1'),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('404 khi combo không tồn tại', async () => {
      repo.findBasic.mockResolvedValue(null);
      await expect(
        service.update('nope', {} as UpdateComboDto, ALL_BRANCHES),
      ).rejects.toThrow(NotFoundException);
    });

    it('xóa ràng buộc chi nhánh (branchId=null) khi tài khoản toàn quyền', async () => {
      repo.findBasic.mockResolvedValue(makeCombo({ branchId: 'B1' }));
      repo.findById.mockResolvedValue(makeCombo({ branchId: null }));
      await service.update(
        'c1',
        { branchId: null } as UpdateComboDto,
        ALL_BRANCHES,
      );
      const saved = repo.save.mock.calls[0][0];
      expect(saved.branchId).toBeNull();
    });
  });

  // ── Validate thành phần ─────────────────────────────────────────────
  describe('validateItems', () => {
    it('từ chối biến thể trùng nhau', async () => {
      const dto = {
        name: 'C',
        price: '100',
        items: [
          { variantId: 'v1', quantity: 1 },
          { variantId: 'v1', quantity: 2 },
        ],
      } as CreateComboDto;
      await expect(service.create(dto, ALL_BRANCHES)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('từ chối biến thể đang tắt', async () => {
      products.getVariantOrFail.mockResolvedValue({
        isActive: false,
        sku: 'X',
      });
      const dto = {
        name: 'C',
        price: '100',
        items: [{ variantId: 'v1', quantity: 1 }],
      } as CreateComboDto;
      await expect(service.create(dto, ALL_BRANCHES)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── Nở combo thành dòng đơn (phân bổ giá) ────────────────────────────
  describe('resolveComboLineItems', () => {
    it('phân bổ giá combo về các dòng, tổng khớp price × qty', async () => {
      repo.findById.mockResolvedValue(
        makeCombo({
          price: '100',
          items: [item('v1', 1, '70'), item('v2', 2, '15')] as never,
        }),
      );

      const lines = await service.resolveComboLineItems('c1', 3);

      const total = lines.reduce(
        (sum, l) => sum + Number(l.unitPrice) * l.quantity,
        0,
      );
      expect(total).toBeCloseTo(100 * 3, 2);
      expect(lines.every((l) => l.comboId === 'c1')).toBe(true);
    });

    it('từ chối combo không bán được (ngoài lịch / đã tắt)', async () => {
      repo.findById.mockResolvedValue(
        makeCombo({
          status: ComboStatus.INACTIVE,
          items: [item('v1', 1)] as never,
        }),
      );
      await expect(service.resolveComboLineItems('c1', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('404 khi combo không tồn tại', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.resolveComboLineItems('x', 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
