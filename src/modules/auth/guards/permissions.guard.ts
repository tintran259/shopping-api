import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../../../common/decorators/require-permission.decorator';
import { CustomerRole } from '../../../common/enums';
import { ALL_PERMISSIONS, Permission } from '../../../common/permissions';
import { CustomersService } from '../../customers/services/customers.service';
import { AuthContext, buildAuthContext } from '../auth-context';

/**
 * Guard toàn cục (chạy sau JwtAuthGuard). Với endpoint có `@RequirePermission`:
 *  - Super Admin: bỏ qua (toàn quyền, mọi chi nhánh).
 *  - Admin thường: nạp StaffRole từ DB (luôn tươi — đổi quyền có hiệu lực ngay,
 *    không cần đăng nhập lại) và kiểm tra quyền.
 * Luôn gắn `request.authContext` (quyền + phạm vi chi nhánh) để service dùng cho
 * scoping theo chi nhánh ở Phase 2. Endpoint không gắn decorator → bỏ qua.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly customers: CustomersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new UnauthorizedException('Chưa đăng nhập');

    let authContext: AuthContext;
    if (user.role === CustomerRole.SUPER_ADMIN) {
      authContext = {
        isSuperAdmin: true,
        permissions: [...ALL_PERMISSIONS],
        allBranches: true,
        branchIds: [],
      };
    } else {
      const customer = await this.customers.findByIdWithStaffRole(user.id);
      if (!customer) throw new UnauthorizedException('Tài khoản không tồn tại');
      authContext = buildAuthContext(customer);
    }

    // any-of: có ít nhất một trong các quyền yêu cầu là qua.
    const ok = required.some((p) => authContext.permissions.includes(p));
    if (!ok) {
      throw new ForbiddenException('Bạn không có quyền truy cập chức năng này');
    }

    request.authContext = authContext;
    return true;
  }
}
