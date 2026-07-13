import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds `shipping_methods` to vouchers — a comma-separated list (TypeORM
 *  `simple-array`) of the home-delivery methods a `shipping` voucher applies
 *  to (`standard`/`express`). Empty = every method. See
 *  `VouchersService.evaluate` for enforcement. */
export class VoucherShippingMethods1784400000000 implements MigrationInterface {
  name = 'VoucherShippingMethods1784400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vouchers" ADD "shipping_methods" text NOT NULL DEFAULT ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vouchers" DROP COLUMN "shipping_methods"`,
    );
  }
}
