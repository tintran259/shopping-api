import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddressLabel1782800000000 implements MigrationInterface {
  name = 'AddressLabel1782800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "label" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "addresses" DROP COLUMN IF EXISTS "label"`,
    );
  }
}
