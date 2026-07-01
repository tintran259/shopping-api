import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderItemImage1783000000000 implements MigrationInterface {
  name = 'OrderItemImage1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "image_url" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN IF EXISTS "image_url"`,
    );
  }
}
