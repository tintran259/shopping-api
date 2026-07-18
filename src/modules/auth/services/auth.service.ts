import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CustomerStatus } from '../../../common/enums';
import { CmsService } from '../../cms/cms.service';
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
    private readonly cms: CmsService,
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

  private async buildAuthResponse(customer: Customer) {
    const accessToken = this.jwt.sign({
      sub: customer.id,
      email: customer.email,
      role: customer.role,
    });
    return { accessToken, user: await this.buildProfile(customer) };
  }

  /** Hồ sơ + quyền hiệu lực (isSuperAdmin/permissions/allBranches/branchIds). */
  private async buildProfile(customer: Customer) {
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
      // Token auto-login CMS kèm sẵn khi đăng nhập (chỉ cho user có quyền
      // `cms.view` / super admin). Lỗi CMS KHÔNG được làm hỏng đăng nhập BO →
      // nuốt lỗi, trả null; nav CMS sẽ tự xin lại token khi bấm.
      cms: await this.buildCmsHandle(ctx.isSuperAdmin, ctx.permissions),
    };
  }

  private async buildCmsHandle(isSuperAdmin: boolean, permissions: string[]) {
    if (!isSuperAdmin && !permissions.includes('cms.view')) return null;
    try {
      const { token, ssoUrl } = await this.cms.getLoginToken();
      return { ssoUrl, token };
    } catch {
      return null;
    }
  }
}
