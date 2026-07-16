import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RBAC nền tảng (Phase 1):
 *  - Thêm `super_admin` vào `customers_role_enum` (rename→create→swap để an toàn
 *    trong transaction, không vướng "unsafe use of new enum value").
 *  - Tạo bảng `staff_roles` (permissions + phạm vi chi nhánh).
 *  - Thêm `customers.staff_role_id` (FK, SET NULL khi xoá role).
 *  - Chuyển mọi admin hiện có → super_admin để không mất quyền (admin mới sau
 *    này tạo qua màn quản trị sẽ là `admin` + gán 1 staff role).
 */
export class StaffRolesRbac1784700000000 implements MigrationInterface {
  name = 'StaffRolesRbac1784700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) enum: customer, admin → + super_admin
    await queryRunner.query(
      `ALTER TYPE "customers_role_enum" RENAME TO "customers_role_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "customers_role_enum" AS ENUM('customer', 'admin', 'super_admin')`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "role" TYPE "customers_role_enum" USING "role"::text::"customers_role_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "role" SET DEFAULT 'customer'`,
    );
    await queryRunner.query(`DROP TYPE "customers_role_enum_old"`);

    // 2) bảng staff_roles
    await queryRunner.query(`
      CREATE TABLE "staff_roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "description" text,
        "permissions" text NOT NULL DEFAULT '',
        "all_branches" boolean NOT NULL DEFAULT false,
        "branch_ids" text NOT NULL DEFAULT '',
        CONSTRAINT "PK_staff_roles" PRIMARY KEY ("id")
      )
    `);

    // 3) customers.staff_role_id + FK
    await queryRunner.query(`ALTER TABLE "customers" ADD "staff_role_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "FK_customers_staff_role" FOREIGN KEY ("staff_role_id") REFERENCES "staff_roles"("id") ON DELETE SET NULL`,
    );

    // 4) admin hiện có → super_admin (giữ nguyên quyền full)
    await queryRunner.query(
      `UPDATE "customers" SET "role" = 'super_admin' WHERE "role" = 'admin'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "customers" SET "role" = 'admin' WHERE "role" = 'super_admin'`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT "FK_customers_staff_role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN "staff_role_id"`,
    );
    await queryRunner.query(`DROP TABLE "staff_roles"`);

    await queryRunner.query(
      `ALTER TYPE "customers_role_enum" RENAME TO "customers_role_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "customers_role_enum" AS ENUM('customer', 'admin')`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "role" TYPE "customers_role_enum" USING "role"::text::"customers_role_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "role" SET DEFAULT 'customer'`,
    );
    await queryRunner.query(`DROP TYPE "customers_role_enum_old"`);
  }
}
