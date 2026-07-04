import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Orders gain a `channel` — lets the BO tell staff-entered orders (phone/
 * walk-in/B2B, created via POST /admin/orders) apart from ones the customer
 * placed themselves through the storefront. Existing rows default to
 * 'storefront' (the only channel that existed before this feature).
 */
export class OrderChannel1783100000000 implements MigrationInterface {
  name = 'OrderChannel1783100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `DO $$ BEGIN
        CREATE TYPE "orders_channel_enum" AS ENUM ('storefront', 'admin');
      EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await q.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "channel" "orders_channel_enum" NOT NULL DEFAULT 'storefront'`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "channel"`);
    await q.query(`DROP TYPE IF EXISTS "orders_channel_enum"`);
  }
}
