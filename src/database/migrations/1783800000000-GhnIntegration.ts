import { MigrationInterface, QueryRunner } from 'typeorm';

/** Fields needed to create a real GHN shipping order: a product variant's
 *  weight (GHN requires it per shipment) and which GHN "shop" a branch ships
 *  from (the pickup address is configured once in GHN's own merchant
 *  dashboard against a shop id — we just need to know which shop id maps to
 *  which branch). Also widens `shipments` with a raw carrier-status string,
 *  since GHN's own status vocabulary (picking/delivering/delivery_fail/
 *  return/...) is far more granular than our 3-value `ShipmentStatus` and
 *  nothing should be silently lost when compressing into it. */
export class GhnIntegration1783800000000 implements MigrationInterface {
  name = 'GhnIntegration1783800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD "weight_gram" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" ADD "ghn_shop_id" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" ADD "carrier_status_raw" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shipments" DROP COLUMN "carrier_status_raw"`,
    );
    await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "ghn_shop_id"`);
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP COLUMN "weight_gram"`,
    );
  }
}
