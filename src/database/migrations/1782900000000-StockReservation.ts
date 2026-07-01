import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stock reservation model: inventory gains a `reserved` counter (available =
 * quantity - reserved), and orders track where their stock sits in the
 * reserve → commit → release lifecycle.
 */
export class StockReservation1782900000000 implements MigrationInterface {
  name = 'StockReservation1782900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "reserved" integer NOT NULL DEFAULT 0`,
    );
    await q.query(
      `DO $$ BEGIN
        CREATE TYPE "orders_stock_status_enum" AS ENUM ('reserved', 'committed', 'released');
      EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await q.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stock_status" "orders_stock_status_enum" NOT NULL DEFAULT 'reserved'`,
    );
    await q.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method_code" character varying`,
    );
    // Existing orders already deducted stock under the old model → mark committed
    // so cancelling them restocks (rather than double-releasing).
    await q.query(
      `UPDATE "orders" SET "stock_status" = 'committed' WHERE "status" <> 'cancelled'`,
    );
    await q.query(
      `UPDATE "orders" SET "stock_status" = 'released' WHERE "status" = 'cancelled'`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "payment_method_code"`,
    );
    await q.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "stock_status"`);
    await q.query(`DROP TYPE IF EXISTS "orders_stock_status_enum"`);
    await q.query(`ALTER TABLE "inventory" DROP COLUMN IF EXISTS "reserved"`);
  }
}
