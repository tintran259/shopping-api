import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the `returned` shipment outcome (failed delivery / return-to-sender)
 *  and a `returned_at` timestamp. Carrier webhooks (GHN `delivery_fail`/
 *  `return`, GHTK `9`/`20`/`21`) now map onto this instead of being recorded
 *  only as `carrier_status_raw` — see `carrier-status-maps.ts`. The enum is
 *  rebuilt (rename → create → swap) rather than `ALTER TYPE ADD VALUE` so the
 *  whole migration stays transaction-safe. */
export class ShipmentReturned1784000000000 implements MigrationInterface {
  name = 'ShipmentReturned1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shipments" ADD "returned_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TYPE "shipments_status_enum" RENAME TO "shipments_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "shipments_status_enum" AS ENUM('pending', 'shipped', 'delivered', 'returned')`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" ALTER COLUMN "status" TYPE "shipments_status_enum" USING "status"::"text"::"shipments_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "shipments_status_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "shipments_status_enum" RENAME TO "shipments_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "shipments_status_enum" AS ENUM('pending', 'shipped', 'delivered')`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" ALTER COLUMN "status" TYPE "shipments_status_enum" USING "status"::"text"::"shipments_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "shipments_status_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "shipments" DROP COLUMN "returned_at"`,
    );
  }
}
