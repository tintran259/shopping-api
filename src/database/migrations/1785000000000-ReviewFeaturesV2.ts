import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Review & Rating System v2:
 *  - `reviews.tags` (quick-tag chips) + `reviews.order_id` (links a review to
 *    the delivered order it came from → drives the `verified` badge).
 *  - `products.sold_count` (incremented when an order reaches DELIVERED).
 *  - Indexes for the storefront read path (product + status) and the
 *    "already reviewed this order?" guard (order_id).
 */
export class ReviewFeaturesV21785000000000 implements MigrationInterface {
  name = 'ReviewFeaturesV21785000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "reviews"
         ADD COLUMN IF NOT EXISTS "tags" text[] NOT NULL DEFAULT '{}',
         ADD COLUMN IF NOT EXISTS "order_id" uuid`,
    );
    await q.query(
      `ALTER TABLE "reviews"
         ADD CONSTRAINT "FK_reviews_order_id"
         FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL`,
    );

    await q.query(
      `ALTER TABLE "products"
         ADD COLUMN IF NOT EXISTS "sold_count" integer NOT NULL DEFAULT 0`,
    );

    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_reviews_product_status"
         ON "reviews" ("product_id", "status")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_reviews_order_id"
         ON "reviews" ("order_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_reviews_order_id"`);
    await q.query(`DROP INDEX IF EXISTS "idx_reviews_product_status"`);
    await q.query(
      `ALTER TABLE "products" DROP COLUMN IF EXISTS "sold_count"`,
    );
    await q.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_order_id"`,
    );
    await q.query(
      `ALTER TABLE "reviews"
         DROP COLUMN IF EXISTS "order_id",
         DROP COLUMN IF EXISTS "tags"`,
    );
  }
}
