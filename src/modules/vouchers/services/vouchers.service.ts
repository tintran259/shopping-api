import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { VoucherType } from '../../../common/enums';
import { CreateVoucherDto, UpdateVoucherDto } from '../dto/voucher.dto';
import { Voucher } from '../entities/voucher.entity';
import { VouchersRepository } from '../repositories/vouchers.repository';

export interface VoucherEvaluation {
  voucher: Voucher;
  discount: number;
}

@Injectable()
export class VouchersService {
  constructor(private readonly vouchers: VouchersRepository) {}

  findAll(): Promise<Voucher[]> {
    return this.vouchers.findAll();
  }

  async create(dto: CreateVoucherDto): Promise<Voucher> {
    const code = dto.code.toUpperCase().trim();
    if (await this.vouchers.findByCode(code)) {
      throw new ConflictException('Voucher code already exists');
    }
    return this.vouchers.save(this.vouchers.create({ ...dto, code }));
  }

  async update(id: string, dto: UpdateVoucherDto): Promise<Voucher> {
    const voucher = await this.vouchers.findById(id);
    if (!voucher) throw new NotFoundException('Voucher not found');
    Object.assign(voucher, dto, dto.code ? { code: dto.code.toUpperCase() } : {});
    return this.vouchers.save(voucher);
  }

  async remove(id: string): Promise<void> {
    const voucher = await this.vouchers.findById(id);
    if (!voucher) throw new NotFoundException('Voucher not found');
    await this.vouchers.remove(voucher);
  }

  /**
   * Validate a code and compute the discount. `shipping` vouchers reduce the
   * shipping fee; `percent`/`fixed` reduce the subtotal.
   */
  async evaluate(
    code: string,
    subtotal: number,
    shippingFee = 0,
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
    if (subtotal < Number(voucher.minSubtotal)) {
      throw new BadRequestException(
        `Order subtotal must be at least ${voucher.minSubtotal}`,
      );
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
    data: { voucherId: string; orderId: string; customerId?: string; amount: string },
  ): Promise<void> {
    return this.vouchers.redeem(manager, data);
  }
}
