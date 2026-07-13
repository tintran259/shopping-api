import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the `problem` shipment status (sự cố cần xử lý: carrier cancel /
 *  pickup-fail / lost / damaged / return-fail) plus a `problem_at` timestamp.
 *  More carrier webhook codes now map onto our coarse statuses (see
 *  `carrier-status-maps.ts`). Enum rebuilt (rename → create → swap) to stay
 *  transaction-safe. */
export class ShipmentProblem1784200000000 implements MigrationInterface {
  name = 'ShipmentProblem1784200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shipments" ADD "problem_at" TIMESTAMP WITH TIME ZONE`,
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "shipments" SET "status" = 'returned' WHERE "status" = 'problem'`,
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
    await queryRunner.query(`ALTER TABLE "shipments" DROP COLUMN "problem_at"`);
  }
}
