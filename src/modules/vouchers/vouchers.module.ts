import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VouchersController } from './controllers/vouchers.controller';
import { VoucherRedemption } from './entities/voucher-redemption.entity';
import { Voucher } from './entities/voucher.entity';
import { VouchersRepository } from './repositories/vouchers.repository';
import { VouchersService } from './services/vouchers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Voucher, VoucherRedemption])],
  controllers: [VouchersController],
  providers: [VouchersService, VouchersRepository],
  exports: [VouchersService],
})
export class VouchersModule {}
