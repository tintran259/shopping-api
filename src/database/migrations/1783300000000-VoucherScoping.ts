import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Voucher scoping: restrict a voucher to specific products ("combo" —
 * applies if the cart has at least one of them), branches, and/or customers.
 * Empty join table rows for a voucher = no restriction on that dimension
 * (see `VouchersService.evaluate`). "Group" vs "1 branch/customer" is just
 * "more than one row" here — no separate group entity.
 */
export class VoucherScoping1783300000000 implements MigrationInterface {
  name = 'VoucherScoping1783300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "voucher_products" (
        "voucher_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        CONSTRAINT "PK_voucher_products" PRIMARY KEY ("voucher_id", "product_id"),
        CONSTRAINT "FK_voucher_products_voucher" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_voucher_products_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);
    await q.query(`
      CREATE TABLE "voucher_branches" (
        "voucher_id" uuid NOT NULL,
        "branch_id" uuid NOT NULL,
        CONSTRAINT "PK_voucher_branches" PRIMARY KEY ("voucher_id", "branch_id"),
        CONSTRAINT "FK_voucher_branches_voucher" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_voucher_branches_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE
      )
    `);
    await q.query(`
      CREATE TABLE "voucher_customers" (
        "voucher_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        CONSTRAINT "PK_voucher_customers" PRIMARY KEY ("voucher_id", "customer_id"),
        CONSTRAINT "FK_voucher_customers_voucher" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_voucher_customers_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "voucher_customers"`);
    await q.query(`DROP TABLE IF EXISTS "voucher_branches"`);
    await q.query(`DROP TABLE IF EXISTS "voucher_products"`);
  }
}
