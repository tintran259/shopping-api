import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds `shipping_method` to orders — the home-delivery method the customer
 *  chose (`standard`/`express`), persisted so the Back Office can flag express
 *  ("giao nhanh") orders for priority handling. Nullable: pickup orders and
 *  pre-existing rows have none. Stored as varchar (not a pg enum) to match the
 *  soft storefront code. */
export class OrderShippingMethod1784500000000 implements MigrationInterface {
  name = 'OrderShippingMethod1784500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "shipping_method" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "shipping_method"`,
    );
  }
}
