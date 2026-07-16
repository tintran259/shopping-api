import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds `expiry_date` to products — the product's shelf-life/use-by date so the
 *  Back Office can list items nearing expiry. Nullable: null = no expiry (vô
 *  thời hạn), for goods without a use-by date (clothing, homeware…). */
export class ProductExpiryDate1784600000000 implements MigrationInterface {
  name = 'ProductExpiryDate1784600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD "expiry_date" date`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "expiry_date"`);
  }
}
