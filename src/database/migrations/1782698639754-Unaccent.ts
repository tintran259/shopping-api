import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enable accent-insensitive search (gõ "tra" vẫn ra "Trà").
 * The `unaccent` extension provides unaccent(text), used in the product/category
 * search WHERE clauses.
 */
export class Unaccent1782698639754 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS unaccent`);
  }
}
