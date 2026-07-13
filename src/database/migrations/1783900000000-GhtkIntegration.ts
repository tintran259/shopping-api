import { MigrationInterface, QueryRunner } from 'typeorm';

/** GHTK's create-order payload requires a "district" (quận/huyện) for both
 *  the pickup and delivery address — a level our own `locations` module no
 *  longer models (2025 reform: province → ward only). The delivery side's
 *  district is unavoidably per-order (varies with the customer), so it's
 *  entered on the create-shipment form; but the pickup side is a per-branch
 *  constant, so it's configured once here — same pattern as `ghn_shop_id`. */
export class GhtkIntegration1783900000000 implements MigrationInterface {
  name = 'GhtkIntegration1783900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branches" ADD "ghtk_pickup_district" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" ADD "ghtk_pickup_ward" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branches" DROP COLUMN "ghtk_pickup_ward"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" DROP COLUMN "ghtk_pickup_district"`,
    );
  }
}
