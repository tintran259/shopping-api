import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchesModule } from '../branches/branches.module';
import { CustomersModule } from '../customers/customers.module';
import { OrdersModule } from '../orders/orders.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

/**
 * Trợ lý AI Back Office (read-only v1). Tái dùng service của Orders/Branches/
 * Customers — tool chỉ ĐỌC và luôn truyền phạm vi chi nhánh của tài khoản, nên
 * phân quyền + branch scope được enforce bởi chính các service sẵn có.
 */
@Module({
  imports: [OrdersModule, BranchesModule, CustomersModule],
  controllers: [AssistantController],
  providers: [AssistantService, RolesGuard],
})
export class AssistantModule {}
