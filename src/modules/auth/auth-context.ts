import { CustomerRole } from '../../common/enums';
import { ALL_PERMISSIONS } from '../../common/permissions';
import { Customer } from '../customers/entities/customer.entity';

/** Ngữ cảnh phân quyền đã giải quyết cho 1 request/tài khoản. */
export interface AuthContext {
  isSuperAdmin: boolean;
  /** Quyền hiệu lực (super admin = toàn bộ). */
  permissions: string[];
  /** True = mọi chi nhánh (super admin hoặc role bật allBranches). */
  allBranches: boolean;
  /** Chi nhánh được phép khi `allBranches=false`. */
  branchIds: string[];
}

/**
 * Dựng {@link AuthContext} từ một customer (đã nạp quan hệ `staffRole`).
 * - `super_admin` → toàn quyền, mọi chi nhánh.
 * - `admin` → theo StaffRole được gán (rỗng nếu chưa gán role).
 * - còn lại (khách) → không quyền BO.
 */
export function buildAuthContext(customer: Customer): AuthContext {
  if (customer.role === CustomerRole.SUPER_ADMIN) {
    return {
      isSuperAdmin: true,
      permissions: [...ALL_PERMISSIONS],
      allBranches: true,
      branchIds: [],
    };
  }
  const role = customer.staffRole;
  return {
    isSuperAdmin: false,
    permissions: role?.permissions ?? [],
    allBranches: role?.allBranches ?? false,
    branchIds: role?.branchIds ?? [],
  };
}
