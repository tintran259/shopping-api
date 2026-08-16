import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gắn combo với một chi nhánh (tùy chọn): `combos.branch_id`. Null = combo bán/
 * tính tồn trên **tất cả** chi nhánh (hành vi cũ). Khi có branch_id, tồn khả dụng
 * của combo chỉ tính trên chi nhánh đó (khớp với việc mỗi đơn giữ kho theo 1
 * chi nhánh). FK SET NULL để xóa chi nhánh không làm hỏng combo.
 */
export class ComboBranch1785600000000 implements MigrationInterface {
  name = 'ComboBranch1785600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "combos" ADD COLUMN "branch_id" uuid`);
    await q.query(
      `ALTER TABLE "combos" ADD CONSTRAINT "FK_combos_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL`,
    );
    await q.query(
      `CREATE INDEX "IDX_combos_branch_id" ON "combos" ("branch_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_combos_branch_id"`);
    await q.query(
      `ALTER TABLE "combos" DROP CONSTRAINT IF EXISTS "FK_combos_branch"`,
    );
    await q.query(`ALTER TABLE "combos" DROP COLUMN IF EXISTS "branch_id"`);
  }
}
