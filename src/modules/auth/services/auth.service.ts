import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CustomerStatus } from '../../../common/enums';
import { CustomersService } from '../../customers/services/customers.service';
import { Customer } from '../../customers/entities/customer.entity';
import { buildAuthContext } from '../auth-context';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly customers: CustomersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const customer = await this.customers.create(dto);
    return this.buildAuthResponse(customer);
  }

  async login(dto: LoginDto) {
    const customer = await this.customers.findByEmailWithSecret(dto.email);
    if (
      !customer ||
      customer.status !== CustomerStatus.ACTIVE ||
      !customer.passwordHash
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, customer.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    // Nạp kèm StaffRole để trả về quyền + phạm vi chi nhánh ngay khi đăng nhập.
    const full = await this.customers.findByIdWithStaffRole(customer.id);
    return this.buildAuthResponse(full ?? customer);
  }

  /** Hồ sơ hiện tại + ngữ cảnh phân quyền (BO dùng để ẩn/hiện menu, gate route). */
  async me(userId: string) {
    const customer = await this.customers.findByIdWithStaffRole(userId);
    if (!customer) throw new UnauthorizedException();
    return this.buildProfile(customer);
  }

  private buildAuthResponse(customer: Customer) {
    const accessToken = this.jwt.sign({
      sub: customer.id,
      email: customer.email,
      role: customer.role,
    });
    return { accessToken, user: this.buildProfile(customer) };
  }

  /** Hồ sơ + quyền hiệu lực (isSuperAdmin/permissions/allBranches/branchIds). */
  private buildProfile(customer: Customer) {
    const ctx = buildAuthContext(customer);
    return {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      type: customer.type,
      role: customer.role,
      staffRoleId: customer.staffRoleId ?? null,
      staffRoleName: customer.staffRole?.name ?? null,
      isSuperAdmin: ctx.isSuperAdmin,
      permissions: ctx.permissions,
      allBranches: ctx.allBranches,
      branchIds: ctx.branchIds,
    };
  }
}
