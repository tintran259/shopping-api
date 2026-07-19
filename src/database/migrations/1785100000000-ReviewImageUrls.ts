import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReviewImageUrls1785100000000 implements MigrationInterface {
  name = 'ReviewImageUrls1785100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "reviews"
         ADD COLUMN IF NOT EXISTS "image_urls" text[] NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "reviews" DROP COLUMN IF EXISTS "image_urls"`,
    );
  }
}
