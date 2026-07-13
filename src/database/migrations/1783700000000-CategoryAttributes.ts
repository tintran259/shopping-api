import { MigrationInterface, QueryRunner } from 'typeorm';

/** Category-level attribute *templates* (e.g. category "Giày" defines a
 *  "Size" SELECT filter with options S/M/L) — distinct from the existing
 *  free-form `product_attributes` table, which holds per-product values with
 *  no schema behind them. */
export class CategoryAttributes1783700000000 implements MigrationInterface {
  name = 'CategoryAttributes1783700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."category_attributes_type_enum" AS ENUM('text', 'number', 'select', 'multiselect', 'boolean')`,
    );
    await queryRunner.query(`
      CREATE TABLE "category_attributes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "category_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "type" "public"."category_attributes_type_enum" NOT NULL,
        "options" jsonb,
        "is_required" boolean NOT NULL DEFAULT false,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_category_attributes" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_category_attributes_category_id" ON "category_attributes" ("category_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "category_attributes"
      ADD CONSTRAINT "FK_category_attributes_category_id"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "category_attributes"`);
    await queryRunner.query(
      `DROP TYPE "public"."category_attributes_type_enum"`,
    );
  }
}
