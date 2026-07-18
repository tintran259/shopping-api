import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminNotificationsModule } from '../admin-notifications/admin-notifications.module';
import { BranchesModule } from '../branches/branches.module';
import { CartModule } from '../cart/cart.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomersModule } from '../customers/customers.module';
import { LocationsModule } from '../locations/locations.module';
import { PaymentsModule } from '../payments/payments.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { AdminOrdersController } from './controllers/admin-orders.controller';
import { GhnWebhookController } from './controllers/ghn-webhook.controller';
import { GhtkWebhookController } from './controllers/ghtk-webhook.controller';
import { OrdersController } from './controllers/orders.controller';
import { OrdersCron } from './orders.cron';
import { Order } from './entities/order.entity';
import { OrderScopeGuard } from './guards/order-scope.guard';
import { OrderItem } from './entities/order-item.entity';
import { Shipment } from './entities/shipment.entity';
import { ShippingMethod } from './entities/shipping-method.entity';
import { OrdersRepository } from './repositories/orders.repository';
import { ShipmentsRepository } from './repositories/shipments.repository';
import { GhnAddressResolver } from './services/ghn-address-resolver';
import { GhnClient } from './services/ghn-client';
import { GhnService } from './services/ghn.service';
import { GhtkClient } from './services/ghtk-client';
import { GhtkService } from './services/ghtk.service';
import { OrdersService } from './services/orders.service';
import { ShipmentsService } from './services/shipments.service';

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
    AdminNotificationsModule,
  ],
  controllers: [
    OrdersController,
    AdminOrdersController,
    GhnWebhookController,
    GhtkWebhookController,
  ],
  providers: [
    OrdersService,
    OrdersRepository,
    OrdersCron,
    ShipmentsService,
    ShipmentsRepository,
    GhnService,
    GhnClient,
    GhnAddressResolver,
    GhtkService,
    GhtkClient,
    OrderScopeGuard,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
