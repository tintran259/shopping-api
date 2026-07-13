import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the `in_transit` shipment stage (đang vận chuyển) between `shipped`
 *  (đã lấy hàng) and `delivered`, plus an `in_transit_at` timestamp. Carrier
 *  webhooks reporting transit (GHN `transporting`/`sorting`/`delivering`,
 *  GHTK `4`) now map here — see `carrier-status-maps.ts`. Enum rebuilt
 *  (rename → create → swap) to stay transaction-safe. */
export class ShipmentInTransit1784100000000 implements MigrationInterface {
  name = 'ShipmentInTransit1784100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shipments" ADD "in_transit_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TYPE "shipments_status_enum" RENAME TO "shipments_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "shipments_status_enum" AS ENUM('pending', 'shipped', 'in_transit', 'delivered', 'returned')`,
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
      `UPDATE "shipments" SET "status" = 'shipped' WHERE "status" = 'in_transit'`,
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
    await queryRunner.query(
      `ALTER TABLE "shipments" DROP COLUMN "in_transit_at"`,
    );
  }
}
