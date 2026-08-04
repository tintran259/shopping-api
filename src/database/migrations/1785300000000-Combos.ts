import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Combo sản phẩm (gói bán kèm giá cố định) + thành phần combo. Kho combo là ẢO
 * (suy từ tồn thành phần), nên không có bảng tồn riêng. Tích hợp đơn hàng/giỏ
 * (cột combo_id ở order_items/cart_items) nằm ở migration Phase A2 riêng.
 */
export class Combos1785300000000 implements MigrationInterface {
  name = 'Combos1785300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TYPE "combos_status_enum" AS ENUM ('draft', 'active', 'inactive')`,
    );
    await q.query(`
      CREATE TABLE "combos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "slug" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "image_url" character varying,
        "price" numeric(12,2) NOT NULL,
        "status" "combos_status_enum" NOT NULL DEFAULT 'draft',
        "starts_at" timestamptz,
        "ends_at" timestamptz,
        CONSTRAINT "PK_combos" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE UNIQUE INDEX "UQ_combos_slug" ON "combos" ("slug")`);
    await q.query(`
      CREATE TABLE "combo_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "combo_id" uuid NOT NULL,
        "variant_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        CONSTRAINT "PK_combo_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_combo_items_combo" FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_combo_items_variant" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE
      )
    `);
    await q.query(
      `CREATE INDEX "IDX_combo_items_combo_id" ON "combo_items" ("combo_id")`,
    );
    await q.query(
      `CREATE INDEX "IDX_combo_items_variant_id" ON "combo_items" ("variant_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "combo_items"`);
    await q.query(`DROP TABLE IF EXISTS "combos"`);
    await q.query(`DROP TYPE IF EXISTS "combos_status_enum"`);
  }
}
