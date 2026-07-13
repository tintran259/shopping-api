import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the `pickup_failed` shipment status — a failure that happens BEFORE
 *  handover to the carrier (couldn't pick up the goods), split out from
 *  `problem` (which is now only for post-handover issues) so the timeline
 *  never shows transit stages that never happened. No new column (reuses
 *  `problem_at`). Enum rebuilt (rename → create → swap) to stay
 *  transaction-safe. */
export class ShipmentPickupFailed1784300000000 implements MigrationInterface {
  name = 'ShipmentPickupFailed1784300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "shipments_status_enum" RENAME TO "shipments_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "shipments_status_enum" AS ENUM('pending', 'shipped', 'in_transit', 'delivered', 'returned', 'problem', 'pickup_failed')`,
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
      `UPDATE "shipments" SET "status" = 'problem' WHERE "status" = 'pickup_failed'`,
    );
    await queryRunner.query(
      `ALTER TYPE "shipments_status_enum" RENAME TO "shipments_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "shipments_status_enum" AS ENUM('pending', 'shipped', 'in_transit', 'delivered', 'returned', 'problem')`,
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
}
