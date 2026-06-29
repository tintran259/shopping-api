import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, EntityManager, Repository } from 'typeorm';
import { Voucher } from '../entities/voucher.entity';
import { VoucherRedemption } from '../entities/voucher-redemption.entity';

@Injectable()
export class VouchersRepository {
  constructor(
    @InjectRepository(Voucher)
    private readonly vouchers: Repository<Voucher>,
    @InjectRepository(VoucherRedemption)
    private readonly redemptions: Repository<VoucherRedemption>,
  ) {}

  create(data: DeepPartial<Voucher>): Voucher {
    return this.vouchers.create(data);
  }

  save(voucher: Voucher): Promise<Voucher> {
    return this.vouchers.save(voucher);
  }

  remove(voucher: Voucher): Promise<Voucher> {
    return this.vouchers.remove(voucher);
  }

  findAll(): Promise<Voucher[]> {
    return this.vouchers.find({ order: { createdAt: 'DESC' } });
  }

  findById(id: string): Promise<Voucher | null> {
    return this.vouchers.findOne({ where: { id } });
  }

  findByCode(code: string): Promise<Voucher | null> {
    return this.vouchers.findOne({ where: { code } });
  }

  /** Record a redemption + bump the usage counter inside the order transaction. */
  async redeem(
    manager: EntityManager,
    data: {
      voucherId: string;
      orderId: string;
      customerId?: string;
      amount: string;
    },
  ): Promise<void> {
    await manager
      .getRepository(Voucher)
      .increment({ id: data.voucherId }, 'usedCount', 1);
    await manager
      .getRepository(VoucherRedemption)
      .save(manager.getRepository(VoucherRedemption).create(data));
  }
}
