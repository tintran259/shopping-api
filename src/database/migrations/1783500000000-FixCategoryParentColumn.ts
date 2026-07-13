import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The initial migration accidentally created TWO parent-reference columns on
 * `categories`: a dead `parent_id` (character varying, never written to —
 * `CategoriesService` writes through the `parentId` TS property which the
 * entity mapped to a *different* physical column) and the camelCase
 * `"parentId"` uuid column that actually carries the FK constraint. Net
 * effect: setting a category's parent has never actually persisted anything.
 * Both columns are still empty in every environment (verified — no category
 * has a parent set yet), so this is a same-day cleanup, not a data migration:
 * drop the dead column and rename the real one to the snake_case name the
 * rest of the schema uses.
 */
export class FixCategoryParentColumn1783500000000 implements MigrationInterface {
  name = 'FixCategoryParentColumn1783500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_9a6f051e66982b5f0318981bcaa"`,
    );
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "parent_id"`);
    await queryRunner.query(
      `ALTER TABLE "categories" RENAME COLUMN "parentId" TO "parent_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_categories_parent_id" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_categories_parent_id" ON "categories" ("parent_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_categories_parent_id"`);
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_categories_parent_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" RENAME COLUMN "parent_id" TO "parentId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD COLUMN "parent_id" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_9a6f051e66982b5f0318981bcaa" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
