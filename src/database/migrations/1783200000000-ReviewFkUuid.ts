import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `reviews.product_id`/`customer_id` were created as plain varchar — the
 * entity never declared a `@ManyToOne` relation before, so TypeORM had no
 * signal to type them `uuid` like every other FK column in this schema.
 * Admin moderation now joins Review → Product/Customer, which fails at
 * query time comparing a varchar column against a uuid primary key. The
 * table has no rows in any environment this has shipped to, so a plain
 * ALTER is safe (no data to lose from the cast).
 */
export class ReviewFkUuid1783200000000 implements MigrationInterface {
  name = 'ReviewFkUuid1783200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "reviews" ALTER COLUMN "product_id" TYPE uuid USING "product_id"::uuid`,
    );
    await q.query(
      `ALTER TABLE "reviews" ALTER COLUMN "customer_id" TYPE uuid USING "customer_id"::uuid`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "reviews" ALTER COLUMN "product_id" TYPE character varying USING "product_id"::text`,
    );
    await q.query(
      `ALTER TABLE "reviews" ALTER COLUMN "customer_id" TYPE character varying USING "customer_id"::text`,
    );
  }
}
