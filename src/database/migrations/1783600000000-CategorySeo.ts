import { MigrationInterface, QueryRunner } from 'typeorm';

/** SEO metadata for category pages (meta title/description) — same loose
 *  jsonb-bag pattern as `products.seo`, so both entities' SEO shape stays
 *  consistent without forcing a rigid column set neither may ever fully use. */
export class CategorySeo1783600000000 implements MigrationInterface {
  name = 'CategorySeo1783600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "categories" ADD "seo" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "seo"`);
  }
}
