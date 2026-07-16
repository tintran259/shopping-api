import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { CustomerRole } from '../../../common/enums';
import { Customer } from '../../customers/entities/customer.entity';
import { CustomersService } from '../../customers/services/customers.service';
import { CreateAdminDto, UpdateAdminDto } from '../dto/admin-account.dto';
import { StaffRole } from '../entities/staff-role.entity';

/**
 * Quản lý tài khoản admin (chỉ Super Admin). Tạo tài khoản `admin` + gán 1
 * StaffRole; sửa role/khoá/đổi mật khẩu; xoá. Không đụng tới tài khoản
 * `super_admin` (tránh tự khoá mình / mất super admin) — quản lý super admin
 * làm ở tầng hạ tầng (seed/DB), không qua UI.
 */
@Injectable()
export class AdminsService {
  constructor(
    private readonly customersService: CustomersService,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    @InjectRepository(StaffRole)
    private readonly roles: Repository<StaffRole>,
  ) {}

  /** Danh sách tài khoản back-office (admin + super_admin), kèm role. */
  findAll(): Promise<Customer[]> {
    return this.customers.find({
      where: [{ role: CustomerRole.ADMIN }, { role: CustomerRole.SUPER_ADMIN }],
      relations: { staffRole: true },
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: CreateAdminDto): Promise<Customer> {
    await this.assertRoleExists(dto.staffRoleId);
    const created = await this.customersService.create({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: CustomerRole.ADMIN,
      staffRoleId: dto.staffRoleId,
    });
    return this.findAdmin(created.id);
  }

  async update(id: string, dto: UpdateAdminDto): Promise<Customer> {
    const admin = await this.findAdmin(id);
    if (dto.staffRoleId !== undefined) {
      await this.assertRoleExists(dto.staffRoleId);
      admin.staffRoleId = dto.staffRoleId;
    }
    if (dto.firstName !== undefined) admin.firstName = dto.firstName;
    if (dto.lastName !== undefined) admin.lastName = dto.lastName;
    if (dto.status !== undefined) admin.status = dto.status;
    if (dto.password) admin.passwordHash = await bcrypt.hash(dto.password, 10);
    await this.customers.save(admin);
    return this.findAdmin(id);
  }

  async remove(id: string): Promise<void> {
    const admin = await this.findAdmin(id);
    await this.customers.remove(admin);
  }

  /** Nạp 1 tài khoản admin (role=admin) — chặn thao tác lên super_admin/khách. */
  private async findAdmin(id: string): Promise<Customer> {
    const admin = await this.customers.findOne({
      where: { id, role: CustomerRole.ADMIN },
      relations: { staffRole: true },
    });
    if (!admin) {
      throw new NotFoundException(
        'Không tìm thấy tài khoản admin (chỉ quản lý tài khoản admin thường).',
      );
    }
    return admin;
  }

  private async assertRoleExists(roleId: string): Promise<void> {
    const exists = await this.roles.exists({ where: { id: roleId } });
    if (!exists) throw new BadRequestException('Vai trò không tồn tại');
  }
}
