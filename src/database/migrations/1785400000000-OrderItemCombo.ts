import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gắn nhãn combo cho dòng đơn hàng: một combo "nở" thành nhiều order-item thành
 * phần, mỗi dòng ghi `combo_id` + `combo_name` (snapshot) để gom nhóm/hiển thị.
 * Không đụng `cart_items` — storefront dùng giỏ client-side + guest-checkout
 * (gửi items qua body), nên combo vào đơn qua đường body-checkout.
 */
export class OrderItemCombo1785400000000 implements MigrationInterface {
  name = 'OrderItemCombo1785400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "combo_id" uuid`,
    );
    await q.query(
      `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "combo_name" character varying`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_order_items_combo_id" ON "order_items" ("combo_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_order_items_combo_id"`);
    await q.query(
      `ALTER TABLE "order_items" DROP COLUMN IF EXISTS "combo_name"`,
    );
    await q.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "combo_id"`);
  }
}
