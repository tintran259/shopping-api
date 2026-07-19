import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Đánh giá theo từng order item (biến thể) thay vì gộp theo sản phẩm: thêm
 * `variant_id` (uuid) + `variant_title` (snapshot nhãn biến thể). `product_id`
 * giữ nguyên để gộp điểm ở cấp sản phẩm. Áp cho cả sản phẩm thường (variant_title
 * rỗng) lẫn sản phẩm có biến thể.
 */
export class ReviewPerOrderItem1785200000000 implements MigrationInterface {
  name = 'ReviewPerOrderItem1785200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "variant_id" uuid`);
    await q.query(
      `ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "variant_title" character varying`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reviews_variant_id" ON "reviews" ("variant_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_reviews_variant_id"`);
    await q.query(`ALTER TABLE "reviews" DROP COLUMN IF EXISTS "variant_title"`);
    await q.query(`ALTER TABLE "reviews" DROP COLUMN IF EXISTS "variant_id"`);
  }
}
