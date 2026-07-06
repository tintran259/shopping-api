import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Splits "who this voucher applies to" into 3 explicit modes instead of only
 * "unrestricted" vs "this specific list of customers": specific accounts,
 * guest checkouts only, or any registered account. Existing vouchers default
 * to 'specific' (their current `voucher_customers` rows, if any, keep
 * meaning exactly what they meant before this migration).
 */
export class VoucherCustomerScope1783400000000 implements MigrationInterface {
  name = 'VoucherCustomerScope1783400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      DO $$ BEGIN
        CREATE TYPE "vouchers_customer_scope_enum" AS ENUM ('specific', 'guests', 'users');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await q.query(`
      ALTER TABLE "vouchers"
      ADD COLUMN IF NOT EXISTS "customer_scope" "vouchers_customer_scope_enum" NOT NULL DEFAULT 'specific'
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "vouchers" DROP COLUMN IF EXISTS "customer_scope"`);
    await q.query(`DROP TYPE IF EXISTS "vouchers_customer_scope_enum"`);
  }
}
