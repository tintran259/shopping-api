import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersModule } from '../customers/customers.module';
import { Customer } from '../customers/entities/customer.entity';
import { AdminsController } from './controllers/admins.controller';
import { RolesController } from './controllers/roles.controller';
import { StaffRole } from './entities/staff-role.entity';
import { AdminsService } from './services/admins.service';
import { RolesService } from './services/roles.service';

/**
 * RBAC — quản lý vai trò (StaffRole) & tài khoản admin. Chỉ Super Admin truy
 * cập (guard theo `roles.manage`/`admins.manage`). `forFeature([Customer])`
 * dùng lại repo Customer sẵn có (autoLoadEntities) để gán/khoá tài khoản.
 */
@Module({
  imports: [TypeOrmModule.forFeature([StaffRole, Customer]), CustomersModule],
  controllers: [RolesController, AdminsController],
  providers: [RolesService, AdminsService],
})
export class RolesModule {}
