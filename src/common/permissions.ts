/**
 * RBAC permission catalog for the Back Office.
 *
 * Mỗi feature có 4 mức thao tác: `.view` (xem/vào trang), `.create` (thêm),
 * `.update` (sửa), `.delete` (xóa) — trừ Dashboard chỉ có `.view`. Không có
 * `.view` ⇒ admin không vào được trang đó; create/update/delete gate riêng từng
 * thao tác (POST/PATCH/DELETE). Super Admin bỏ qua toàn bộ (mọi quyền, mọi chi
 * nhánh). `roles.manage`/`admins.manage` KHÔNG gán được cho role thường — chỉ
 * Super Admin (bypass) truy cập.
 */

const CRUD = ['view', 'create', 'update', 'delete'] as const;

/** Nhóm quyền gán được cho role thường — dùng cho UI (checkbox) + validate. */
export const PERMISSION_GROUPS = [
  { key: 'orders', label: 'Đơn hàng & vận chuyển', actions: CRUD },
  { key: 'catalog', label: 'Sản phẩm, danh mục & thương hiệu', actions: CRUD },
  { key: 'inventory', label: 'Tồn kho & chi nhánh', actions: CRUD },
  { key: 'vouchers', label: 'Voucher', actions: CRUD },
  { key: 'reviews', label: 'Đánh giá', actions: CRUD },
  { key: 'customers', label: 'Khách hàng', actions: CRUD },
  { key: 'dashboard', label: 'Tổng quan', actions: ['view'] as const },
] as const;

/** Quyền có thể gán cho một role (danh sách phẳng). */
export const ASSIGNABLE_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) =>
  g.actions.map((a) => `${g.key}.${a}`),
);

/** Quyền chỉ Super Admin có (không gán cho role thường). */
export const SUPER_ADMIN_ONLY_PERMISSIONS = [
  'roles.manage',
  'admins.manage',
] as const;

export const ALL_PERMISSIONS = [
  ...ASSIGNABLE_PERMISSIONS,
  ...SUPER_ADMIN_ONLY_PERMISSIONS,
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

/** True nếu chuỗi là một quyền gán được (dùng để validate khi tạo/sửa role). */
export function isAssignablePermission(value: string): boolean {
  return ASSIGNABLE_PERMISSIONS.includes(value);
}
