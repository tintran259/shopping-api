import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, QueryFailedError } from 'typeorm';
import { PaginatedResult } from '../../../common/dto/paginated-result';
import { VoucherCustomerScope, VoucherType } from '../../../common/enums';
import { Branch } from '../../branches/entities/branch.entity';
import { Product } from '../../catalog/entities/product.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { AdminVoucherQueryDto, VoucherStateCounts } from '../dto/admin-voucher-query.dto';
import { CreateVoucherDto, UpdateVoucherDto } from '../dto/voucher.dto';
import { Voucher } from '../entities/voucher.entity';
import { VouchersRepository } from '../repositories/vouchers.repository';

export interface VoucherEvaluation {
  voucher: Voucher;
  discount: number;
}

/** Cart/order context checked against a voucher's scoping restrictions
 *  (empty relation on the voucher = unrestricted on that dimension). */
export interface VoucherContext {
  branchId?: string;
  customerId?: string;
  productIds?: string[];
}

@Injectable()
export class VouchersService {
  constructor(private readonly vouchers: VouchersRepository) {}

  findAll(): Promise<Voucher[]> {
    return this.vouchers.findAll();
  }

  async findAllPaginated(query: AdminVoucherQueryDto): Promise<PaginatedResult<Voucher>> {
    const [data, total] = await this.vouchers.searchAdmin(query);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  stateCounts(): Promise<VoucherStateCounts> {
    return this.vouchers.countByState();
  }

  listAvailable(customerId?: string): Promise<Voucher[]> {
    return this.vouchers.findAvailable(customerId);
  }

  async findOne(id: string): Promise<Voucher> {
    const voucher = await this.vouchers.findById(id);
    if (!voucher) throw new NotFoundException('Voucher not found');
    return voucher;
  }

  /** Code has a unique DB index — this converts the constraint violation
   *  into a friendly 409 instead of a raw 500, and is the authoritative
   *  guard against the race where two requests both pass the fast-path
   *  `findByCode` check above before either has saved. */
  private async saveOrThrowConflict(voucher: Voucher): Promise<Voucher> {
    try {
      return await this.vouchers.save(voucher);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException('Mã giảm giá này đã tồn tại — vui lòng chọn mã khác.');
      }
      throw error;
    }
  }

  async create(dto: CreateVoucherDto): Promise<Voucher> {
    const code = dto.code.toUpperCase().trim();
    if (await this.vouchers.findByCode(code)) {
      throw new ConflictException('Mã giảm giá này đã tồn tại — vui lòng chọn mã khác.');
    }
    const { productIds, branchIds, customerIds, ...rest } = dto;
    return this.saveOrThrowConflict(
      this.vouchers.create({
        ...rest,
        code,
        products: productIds?.map((id) => ({ id }) as Product),
        branches: branchIds?.map((id) => ({ id }) as Branch),
        customers: customerIds?.map((id) => ({ id }) as Customer),
      }),
    );
  }

  async update(id: string, dto: UpdateVoucherDto): Promise<Voucher> {
    const voucher = await this.vouchers.findById(id);
    if (!voucher) throw new NotFoundException('Voucher not found');
    const { productIds, branchIds, customerIds, ...rest } = dto;
    Object.assign(
      voucher,
      rest,
      dto.code ? { code: dto.code.toUpperCase() } : {},
    );
    // Only touch a scoping relation if its key was actually sent — omitted =
    // leave as-is, `[]` = explicitly clear the restriction (unrestricted).
    if (productIds !== undefined) {
      voucher.products = productIds.map((pid) => ({ id: pid }) as Product);
    }
    if (branchIds !== undefined) {
      voucher.branches = branchIds.map((bid) => ({ id: bid }) as Branch);
    }
    if (customerIds !== undefined) {
      voucher.customers = customerIds.map((cid) => ({ id: cid }) as Customer);
    }
    return this.saveOrThrowConflict(voucher);
  }

  async remove(id: string): Promise<void> {
    const voucher = await this.vouchers.findById(id);
    if (!voucher) throw new NotFoundException('Voucher not found');
    await this.vouchers.remove(voucher);
  }

  /**
   * Validate a code and compute the discount. `shipping` vouchers reduce the
   * shipping fee; `percent`/`fixed` reduce the subtotal. `context` carries
   * what the scoping restrictions (products/branches/customers) check
   * against — omit a field there and any restriction on that dimension will
   * always reject (fail closed, not open).
   */
  async evaluate(
    code: string,
    subtotal: number,
    shippingFee = 0,
    context: VoucherContext = {},
  ): Promise<VoucherEvaluation> {
    const voucher = await this.vouchers.findByCode(code.toUpperCase().trim());
    if (!voucher || !voucher.isActive) {
      throw new BadRequestException('Invalid voucher code');
    }

    const now = new Date();
    if (voucher.startsAt && now < voucher.startsAt) {
      throw new BadRequestException('Voucher is not active yet');
    }
    if (voucher.endsAt && now > voucher.endsAt) {
      throw new BadRequestException('Voucher has expired');
    }
    if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) {
      throw new BadRequestException('Voucher usage limit reached');
    }
    if (voucher.perCustomerLimit != null && context.customerId) {
      const used = await this.vouchers.countRedemptionsByCustomer(
        voucher.id,
        context.customerId,
      );
      if (used >= voucher.perCustomerLimit) {
        throw new BadRequestException('Bạn đã dùng hết lượt cho mã này');
      }
    }
    if (subtotal < Number(voucher.minSubtotal)) {
      throw new BadRequestException(
        `Order subtotal must be at least ${voucher.minSubtotal}`,
      );
    }
    if (
      voucher.branches?.length &&
      !(context.branchId && voucher.branches.some((b) => b.id === context.branchId))
    ) {
      throw new BadRequestException('Mã không áp dụng cho chi nhánh này');
    }
    if (voucher.customerScope === VoucherCustomerScope.GUESTS && context.customerId) {
      throw new BadRequestException('Mã chỉ áp dụng cho khách vãng lai (không đăng nhập)');
    }
    if (voucher.customerScope === VoucherCustomerScope.USERS && !context.customerId) {
      throw new BadRequestException('Mã chỉ áp dụng cho khách đã đăng nhập');
    }
    if (
      voucher.customerScope === VoucherCustomerScope.SPECIFIC &&
      voucher.customers?.length &&
      !(context.customerId && voucher.customers.some((c) => c.id === context.customerId))
    ) {
      throw new BadRequestException('Mã không áp dụng cho tài khoản này');
    }
    if (
      voucher.products?.length &&
      !(context.productIds ?? []).some((pid) =>
        voucher.products!.some((p) => p.id === pid),
      )
    ) {
      throw new BadRequestException('Mã không áp dụng cho sản phẩm trong giỏ hàng');
    }

    let discount: number;
    if (voucher.type === VoucherType.SHIPPING) {
      discount = Math.min(Number(voucher.value), shippingFee);
    } else if (voucher.type === VoucherType.PERCENT) {
      discount = (subtotal * Number(voucher.value)) / 100;
      if (voucher.maxDiscount != null) {
        discount = Math.min(discount, Number(voucher.maxDiscount));
      }
      discount = Math.min(discount, subtotal);
    } else {
      discount = Math.min(Number(voucher.value), subtotal);
    }

    return { voucher, discount: Math.round(discount * 100) / 100 };
  }

  /** Record a redemption within the order transaction. */
  redeem(
    manager: EntityManager,
    data: {
      voucherId: string;
      orderId: string;
      customerId?: string;
      amount: string;
    },
  ): Promise<void> {
    return this.vouchers.redeem(manager, data);
  }

  /** Reverse a redemption when its order is cancelled — see repository for details. */
  unredeem(manager: EntityManager, orderId: string): Promise<void> {
    return this.vouchers.unredeem(manager, orderId);
  }
}
