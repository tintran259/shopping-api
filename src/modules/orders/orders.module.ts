import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchesModule } from '../branches/branches.module';
import { CartModule } from '../cart/cart.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomersModule } from '../customers/customers.module';
import { LocationsModule } from '../locations/locations.module';
import { PaymentsModule } from '../payments/payments.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { OrdersController } from './controllers/orders.controller';
import { OrdersCron } from './orders.cron';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Shipment } from './entities/shipment.entity';
import { ShippingMethod } from './entities/shipping-method.entity';
import { OrdersRepository } from './repositories/orders.repository';
import { OrdersService } from './services/orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, ShippingMethod, Shipment]),
    CartModule,
    CatalogModule,
    VouchersModule,
    PaymentsModule,
    CustomersModule,
    BranchesModule,
    LocationsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, OrdersCron],
  exports: [OrdersService],
})
export class OrdersModule {}
