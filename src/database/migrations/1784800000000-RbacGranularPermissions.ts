import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RBAC: tách `.manage` thành `.create/.update/.delete` (Thêm/Sửa/Xóa riêng).
 * Cập nhật các StaffRole hiện có: mỗi `<feature>.manage` trong cột
 * `staff_roles.permissions` (chuỗi phân tách bởi dấu phẩy) được mở rộng thành
 * `<feature>.create,<feature>.update,<feature>.delete` để không mất quyền ghi.
 */
export class RbacGranularPermissions1784800000000
  implements MigrationInterface
{
  name = 'RbacGranularPermissions1784800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "staff_roles"
      SET "permissions" = regexp_replace(
        "permissions",
        '([a-z]+)\\.manage',
        '\\1.create,\\1.update,\\1.delete',
        'g'
      )
      WHERE "permissions" LIKE '%.manage%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Best-effort: gộp lại về `.manage` (có thể để lại trùng lặp vô hại).
    await queryRunner.query(`
      UPDATE "staff_roles"
      SET "permissions" = regexp_replace(
        "permissions",
        '([a-z]+)\\.create,\\1\\.update,\\1\\.delete',
        '\\1.manage',
        'g'
      )
    `);
  }
}
