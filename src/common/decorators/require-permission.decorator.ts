import { SetMetadata } from '@nestjs/common';
import { Permission } from '../permissions';

export const PERMISSION_KEY = 'required_permission';

/**
 * Yêu cầu quyền để vào endpoint (enforce bởi `PermissionsGuard`). Super Admin bỏ
 * qua; admin thường phải có ÍT NHẤT MỘT trong các quyền liệt kê (any-of). Dùng
 * `<feature>.view` cho GET, `.create`/`.update`/`.delete` cho POST/PATCH/DELETE.
 * Truyền nhiều quyền cho endpoint dùng chung (vd upload dùng cả create/update).
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSION_KEY, permissions);
