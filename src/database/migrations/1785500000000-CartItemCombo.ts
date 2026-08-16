import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cho phép giỏ hàng (server cart) chứa dòng combo: thêm `combo_id` và cho
 * `variant_id` nullable — một dòng giỏ là *hoặc* biến thể *hoặc* combo. Khi
 * checkout, dòng combo "nở" thành các dòng thành phần (giữ kho theo variant).
 */
export class CartItemCombo1785500000000 implements MigrationInterface {
  name = 'CartItemCombo1785500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "cart_items" ALTER COLUMN "variant_id" DROP NOT NULL`,
    );
    await q.query(
      `ALTER TABLE "cart_items" ADD COLUMN IF NOT EXISTS "combo_id" uuid`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cart_items_combo_id" ON "cart_items" ("combo_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_cart_items_combo_id"`);
    // Bỏ dòng combo trước khi khôi phục ràng buộc NOT NULL cho variant_id.
    await q.query(`DELETE FROM "cart_items" WHERE "variant_id" IS NULL`);
    await q.query(`ALTER TABLE "cart_items" DROP COLUMN IF EXISTS "combo_id"`);
    await q.query(
      `ALTER TABLE "cart_items" ALTER COLUMN "variant_id" SET NOT NULL`,
    );
  }
}
