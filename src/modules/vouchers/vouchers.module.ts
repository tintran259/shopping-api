import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '../branches/entities/branch.entity';
import { Product } from '../catalog/entities/product.entity';
import { Customer } from '../customers/entities/customer.entity';
import { VouchersController } from './controllers/vouchers.controller';
import { VoucherRedemption } from './entities/voucher-redemption.entity';
import { Voucher } from './entities/voucher.entity';
import { VouchersRepository } from './repositories/vouchers.repository';
import { VouchersService } from './services/vouchers.service';

@Module({
  // Product/Branch/Customer are registered here (not via their owning
  // modules) purely so Voucher's scoping relations resolve — importing
  // CatalogModule/BranchesModule/CustomersModule would risk circularity
  // since OrdersModule already imports VouchersModule.
  imports: [
    TypeOrmModule.forFeature([
      Voucher,
      VoucherRedemption,
      Product,
      Branch,
      Customer,
    ]),
  ],
  controllers: [VouchersController],
  providers: [VouchersService, VouchersRepository],
  exports: [VouchersService],
})
export class VouchersModule {}
