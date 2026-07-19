import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phản hồi công khai của shop cho đánh giá: cột `reply` (text) + `replied_at`
 * (timestamptz), song song với `body`. Null = chưa phản hồi.
 */
export class ReviewReply1785100000000 implements MigrationInterface {
  name = 'ReviewReply1785100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "reply" text`);
    await q.query(
      `ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "replied_at" timestamptz`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "reviews" DROP COLUMN IF EXISTS "replied_at"`);
    await q.query(`ALTER TABLE "reviews" DROP COLUMN IF EXISTS "reply"`);
  }
}
