import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1782312974436 implements MigrationInterface {
  name = 'Init1782312974436';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "wishlist_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "wishlist_id" uuid NOT NULL, "product_id" character varying NOT NULL, "variant_id" uuid, CONSTRAINT "PK_0bd52924a97cda208ed2a07bd69" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "wishlists" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "customer_id" character varying NOT NULL, "name" character varying NOT NULL, "is_default" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_d0a37f2848c5d268d315325f359" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1ecae3acee67b8f1b5ae9f5149" ON "wishlists" ("customer_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."vouchers_type_enum" AS ENUM('percent', 'fixed', 'shipping')`,
    );
    await queryRunner.query(
      `CREATE TABLE "vouchers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying NOT NULL, "type" "public"."vouchers_type_enum" NOT NULL, "value" numeric(12,2) NOT NULL, "min_subtotal" numeric(12,2) NOT NULL DEFAULT '0', "max_discount" numeric(12,2), "usage_limit" integer, "used_count" integer NOT NULL DEFAULT '0', "per_customer_limit" integer, "starts_at" TIMESTAMP WITH TIME ZONE, "ends_at" TIMESTAMP WITH TIME ZONE, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_ed1b7dd909a696560763acdbc04" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_efc30b2b9169e05e0e1e19d6dd" ON "vouchers" ("code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "voucher_redemptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "voucher_id" uuid NOT NULL, "order_id" uuid NOT NULL, "customer_id" uuid, "amount" numeric(12,2) NOT NULL, CONSTRAINT "PK_7597edcf0976617dad5154737f6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0af64d5936a69889a91978ce81" ON "voucher_redemptions" ("voucher_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reviews_status_enum" AS ENUM('pending', 'published', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "product_id" character varying NOT NULL, "customer_id" character varying NOT NULL, "rating" integer NOT NULL, "title" character varying, "body" text, "status" "public"."reviews_status_enum" NOT NULL DEFAULT 'pending', CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9482e9567d8dcc2bc615981ef4" ON "reviews" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "order_id" uuid NOT NULL, "variant_id" character varying NOT NULL, "product_name" character varying NOT NULL, "variant_title" character varying NOT NULL, "sku" character varying NOT NULL, "unit_price" numeric(12,2) NOT NULL, "quantity" integer NOT NULL, "line_total" numeric(12,2) NOT NULL, CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_fulfillment_enum" AS ENUM('delivery', 'pickup')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_status_enum" AS ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_payment_status_enum" AS ENUM('pending', 'paid', 'failed', 'refunded')`,
    );
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying NOT NULL, "customer_id" uuid, "branch_id" uuid NOT NULL, "fulfillment" "public"."orders_fulfillment_enum" NOT NULL, "status" "public"."orders_status_enum" NOT NULL DEFAULT 'pending', "payment_status" "public"."orders_payment_status_enum" NOT NULL DEFAULT 'pending', "recipient_name" character varying NOT NULL, "recipient_phone" character varying NOT NULL, "recipient_email" character varying, "shipping_address" jsonb, "subtotal" numeric(12,2) NOT NULL, "shipping_fee" numeric(12,2) NOT NULL DEFAULT '0', "discount_total" numeric(12,2) NOT NULL DEFAULT '0', "grand_total" numeric(12,2) NOT NULL, "currency" character varying NOT NULL DEFAULT 'VND', "voucher_code" character varying, "invoice" jsonb, "notes" text, "placed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3e413c10c595c04c6c70e58a4d" ON "orders" ("code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_772d0ce0473ac2ccfa26060dbe" ON "orders" ("customer_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_method_code_enum" AS ENUM('bank_transfer', 'momo', 'atm_card', 'cod')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('pending', 'paid', 'failed', 'refunded')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "order_id" uuid NOT NULL, "method_code" "public"."payments_method_code_enum" NOT NULL, "amount" numeric(12,2) NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'pending', "transaction_ref" character varying, "payload" jsonb NOT NULL DEFAULT '{}', "paid_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b2f7b823a21562eeca20e72b00" ON "payments" ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "shipping_methods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying NOT NULL, "label" character varying NOT NULL, "eta" character varying, CONSTRAINT "PK_5bee9dd62a8b72d6d9caabd63cf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e290dcae2c0ff391ceea3e8978" ON "shipping_methods" ("code") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shipments_status_enum" AS ENUM('pending', 'shipped', 'delivered')`,
    );
    await queryRunner.query(
      `CREATE TABLE "shipments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "order_id" uuid NOT NULL, "shipping_method_id" uuid, "carrier" character varying, "tracking_no" character varying, "status" "public"."shipments_status_enum" NOT NULL DEFAULT 'pending', "fee" numeric(12,2) NOT NULL DEFAULT '0', "shipped_at" TIMESTAMP WITH TIME ZONE, "delivered_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6deda4532ac542a93eab214b564" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "back_in_stock_subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "variant_id" character varying NOT NULL, "branch_id" uuid, "customer_id" uuid, "contact" character varying NOT NULL, "notified_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_032ce35c8240262d281dbe9d28f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3084ab1ce203cff522888bf5e7" ON "back_in_stock_subscriptions" ("variant_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "provinces" ("code" integer NOT NULL, "name" character varying NOT NULL, "division_type" character varying, "codename" character varying, "phone_code" integer, CONSTRAINT "PK_f4b684af62d5cb3aa174f6b9b8a" PRIMARY KEY ("code"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "wards" ("code" integer NOT NULL, "name" character varying NOT NULL, "division_type" character varying, "codename" character varying, "province_code" integer NOT NULL, CONSTRAINT "PK_24f16d2207b1dcb6ce07d81d20f" PRIMARY KEY ("code"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6c3a8d384c72ec02bd6dc0ebfe" ON "wards" ("province_code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "addresses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "customer_id" uuid NOT NULL, "recipient_name" character varying NOT NULL, "phone" character varying NOT NULL, "province_code" integer NOT NULL, "province_name" character varying NOT NULL, "ward_code" integer NOT NULL, "ward_name" character varying NOT NULL, "street" character varying NOT NULL, "is_default" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_745d8f43d3af10ab8247465e450" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "b2b_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "customer_id" uuid NOT NULL, "company_name" character varying NOT NULL, "tax_code" character varying NOT NULL, "company_address" character varying, "price_tier_id" uuid, "credit_limit" numeric(14,2) NOT NULL DEFAULT '0', "payment_terms" character varying, CONSTRAINT "UQ_08672de6cf51488acf8bd8c54c1" UNIQUE ("customer_id"), CONSTRAINT "REL_08672de6cf51488acf8bd8c54c" UNIQUE ("customer_id"), CONSTRAINT "PK_b8ac9ac32b95dd2c012e1eeced8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customers_type_enum" AS ENUM('individual', 'b2b')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customers_role_enum" AS ENUM('customer', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customers_status_enum" AS ENUM('active', 'disabled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying, "phone" character varying, "password_hash" character varying, "type" "public"."customers_type_enum" NOT NULL DEFAULT 'individual', "role" "public"."customers_role_enum" NOT NULL DEFAULT 'customer', "first_name" character varying, "last_name" character varying, "status" "public"."customers_status_enum" NOT NULL DEFAULT 'active', "default_branch_id" uuid, CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_bc96df35477b27f8c7a9a214ee" ON "customers" ("email") WHERE "email" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "brands" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "slug" character varying NOT NULL, "name" character varying NOT NULL, "logo_url" character varying, CONSTRAINT "PK_b0c437120b624da1034a81fc561" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b15428f362be2200922952dc26" ON "brands" ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "description" text, "image_url" character varying, "sort_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "parent_id" character varying, "parentId" uuid, CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_420d9f679d41281f282f5bc7d0" ON "categories" ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "product_attributes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "product_id" uuid NOT NULL, "key" character varying NOT NULL, "label" character varying NOT NULL, "value" jsonb NOT NULL, "group" character varying, CONSTRAINT "PK_4fa18fc5c893cb9894fc40ca921" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_images" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "product_id" uuid NOT NULL, "url" character varying NOT NULL, "alt" character varying, "is_primary" boolean NOT NULL DEFAULT false, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_1974264ea7265989af8392f63a1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_option_values" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "option_id" uuid NOT NULL, "value" character varying NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_c5ddd425048b2df1a76cb9d5226" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."product_options_display_type_enum" AS ENUM('swatch', 'pill', 'dropdown')`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_options" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "product_id" uuid NOT NULL, "name" character varying NOT NULL, "display_type" "public"."product_options_display_type_enum" NOT NULL DEFAULT 'pill', "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_3916b02fb43aa725f8167c718e4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_variants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "product_id" uuid NOT NULL, "sku" character varying NOT NULL, "price" numeric(12,2) NOT NULL, "compare_at_price" numeric(12,2), "image_url" character varying, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_281e3f2c55652d6a22c0aa59fd7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_46f236f21640f9da218a063a86" ON "product_variants" ("sku") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."products_status_enum" AS ENUM('active', 'draft', 'preorder', 'out_of_stock', 'discontinued')`,
    );
    await queryRunner.query(
      `CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "slug" character varying NOT NULL, "name" character varying NOT NULL, "brand_id" uuid, "status" "public"."products_status_enum" NOT NULL DEFAULT 'draft', "short_description" text, "description" text, "base_price" numeric(12,2) NOT NULL DEFAULT '0', "compare_at_price" numeric(12,2), "currency" character varying NOT NULL DEFAULT 'VND', "flags" jsonb NOT NULL DEFAULT '{}', "rating_avg" numeric(3,2) NOT NULL DEFAULT '0', "rating_count" integer NOT NULL DEFAULT '0', "seo" jsonb, CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_464f927ae360106b783ed0b410" ON "products" ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "price_list_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "price_tier_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "price" numeric(12,2) NOT NULL, CONSTRAINT "PK_cdb44449658589feac39de86695" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_d40b39783ca1a0db443aa422d9" ON "price_list_items" ("price_tier_id", "variant_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "price_tiers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, CONSTRAINT "PK_32e26c73f31f2d3a75bb2143d62" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "cart_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "cart_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "quantity" integer NOT NULL, "unit_price" numeric(12,2) NOT NULL, CONSTRAINT "PK_6fccf5ec03c172d27a28a82928b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."carts_status_enum" AS ENUM('active', 'converted', 'abandoned')`,
    );
    await queryRunner.query(
      `CREATE TABLE "carts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "customer_id" uuid, "session_id" character varying, "branch_id" uuid, "status" "public"."carts_status_enum" NOT NULL DEFAULT 'active', "currency" character varying NOT NULL DEFAULT 'VND', CONSTRAINT "PK_b5f695a59f5ebb50af3c8160816" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5a9dade7a4baafc128f8e0d804" ON "carts" ("customer_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "branches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "address" character varying, "city" character varying, "province_code" character varying, "phone" character varying, "is_default" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_7f37d3b42defea97f1df0d19535" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."inventory_status_enum" AS ENUM('in_stock', 'preorder', 'out_of_stock')`,
    );
    await queryRunner.query(
      `CREATE TABLE "inventory" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branch_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "quantity" integer NOT NULL DEFAULT '0', "status" "public"."inventory_status_enum" NOT NULL DEFAULT 'in_stock', CONSTRAINT "PK_82aa5da437c5bbfb80703b08309" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c351cd4db6142b522da9068838" ON "inventory" ("branch_id", "variant_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "variant_option_values" ("variant_id" uuid NOT NULL, "option_value_id" uuid NOT NULL, CONSTRAINT "PK_44501649a4f45de8e349946225d" PRIMARY KEY ("variant_id", "option_value_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3d396f66a33e2328f439515abd" ON "variant_option_values" ("variant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c80b92276d57bd3b469eccd62e" ON "variant_option_values" ("option_value_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "product_categories" ("product_id" uuid NOT NULL, "category_id" uuid NOT NULL, CONSTRAINT "PK_54f2e1dbf14cfa770f59f0aac8f" PRIMARY KEY ("product_id", "category_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8748b4a0e8de6d266f2bbc877f" ON "product_categories" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9148da8f26fc248e77a387e311" ON "product_categories" ("category_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "wishlist_items" ADD CONSTRAINT "FK_754a9ecec7627d432c2134dd00e" FOREIGN KEY ("wishlist_id") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "FK_0af64d5936a69889a91978ce812" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_b2f7b823a21562eeca20e72b006" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" ADD CONSTRAINT "FK_e86fac2a18a75dcb82bfbb23f43" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" ADD CONSTRAINT "FK_c0b004da33090be7e934ac28e2b" FOREIGN KEY ("shipping_method_id") REFERENCES "shipping_methods"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "wards" ADD CONSTRAINT "FK_6c3a8d384c72ec02bd6dc0ebfef" FOREIGN KEY ("province_code") REFERENCES "provinces"("code") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "addresses" ADD CONSTRAINT "FK_7482082bf53fd0ba88a32e3de88" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "b2b_profiles" ADD CONSTRAINT "FK_08672de6cf51488acf8bd8c54c1" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_9a6f051e66982b5f0318981bcaa" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_attributes" ADD CONSTRAINT "FK_f5a6700abd0494bae3032cf5bbd" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_images" ADD CONSTRAINT "FK_4f166bb8c2bfcef2498d97b4068" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_option_values" ADD CONSTRAINT "FK_7afee5fa03c1964f983632ca474" FOREIGN KEY ("option_id") REFERENCES "product_options"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_options" ADD CONSTRAINT "FK_49677f87ad61a8b2a31f33c8a2c" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD CONSTRAINT "FK_6343513e20e2deab45edfce1316" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_1530a6f15d3c79d1b70be98f2be" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "price_list_items" ADD CONSTRAINT "FK_dea392c4046b1a86d1bc1557dc9" FOREIGN KEY ("price_tier_id") REFERENCES "price_tiers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "price_list_items" ADD CONSTRAINT "FK_bb9d00bdcb2b2578c8d2cc96438" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" ADD CONSTRAINT "FK_6385a745d9e12a89b859bb25623" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" ADD CONSTRAINT "FK_ede780fc2b865d1d1323e598038" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory" ADD CONSTRAINT "FK_5e4d38ade6f246f20f468a7ad4b" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory" ADD CONSTRAINT "FK_ceba910e3505fc54c3c7f92c943" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "variant_option_values" ADD CONSTRAINT "FK_3d396f66a33e2328f439515abdf" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "variant_option_values" ADD CONSTRAINT "FK_c80b92276d57bd3b469eccd62eb" FOREIGN KEY ("option_value_id") REFERENCES "product_option_values"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_categories" ADD CONSTRAINT "FK_8748b4a0e8de6d266f2bbc877f6" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_categories" ADD CONSTRAINT "FK_9148da8f26fc248e77a387e3112" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_categories" DROP CONSTRAINT "FK_9148da8f26fc248e77a387e3112"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_categories" DROP CONSTRAINT "FK_8748b4a0e8de6d266f2bbc877f6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "variant_option_values" DROP CONSTRAINT "FK_c80b92276d57bd3b469eccd62eb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "variant_option_values" DROP CONSTRAINT "FK_3d396f66a33e2328f439515abdf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory" DROP CONSTRAINT "FK_ceba910e3505fc54c3c7f92c943"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory" DROP CONSTRAINT "FK_5e4d38ade6f246f20f468a7ad4b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" DROP CONSTRAINT "FK_ede780fc2b865d1d1323e598038"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" DROP CONSTRAINT "FK_6385a745d9e12a89b859bb25623"`,
    );
    await queryRunner.query(
      `ALTER TABLE "price_list_items" DROP CONSTRAINT "FK_bb9d00bdcb2b2578c8d2cc96438"`,
    );
    await queryRunner.query(
      `ALTER TABLE "price_list_items" DROP CONSTRAINT "FK_dea392c4046b1a86d1bc1557dc9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_1530a6f15d3c79d1b70be98f2be"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP CONSTRAINT "FK_6343513e20e2deab45edfce1316"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_options" DROP CONSTRAINT "FK_49677f87ad61a8b2a31f33c8a2c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_option_values" DROP CONSTRAINT "FK_7afee5fa03c1964f983632ca474"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_images" DROP CONSTRAINT "FK_4f166bb8c2bfcef2498d97b4068"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_attributes" DROP CONSTRAINT "FK_f5a6700abd0494bae3032cf5bbd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_9a6f051e66982b5f0318981bcaa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "b2b_profiles" DROP CONSTRAINT "FK_08672de6cf51488acf8bd8c54c1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "addresses" DROP CONSTRAINT "FK_7482082bf53fd0ba88a32e3de88"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wards" DROP CONSTRAINT "FK_6c3a8d384c72ec02bd6dc0ebfef"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" DROP CONSTRAINT "FK_c0b004da33090be7e934ac28e2b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" DROP CONSTRAINT "FK_e86fac2a18a75dcb82bfbb23f43"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_b2f7b823a21562eeca20e72b006"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_145532db85752b29c57d2b7b1f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "voucher_redemptions" DROP CONSTRAINT "FK_0af64d5936a69889a91978ce812"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wishlist_items" DROP CONSTRAINT "FK_754a9ecec7627d432c2134dd00e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9148da8f26fc248e77a387e311"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8748b4a0e8de6d266f2bbc877f"`,
    );
    await queryRunner.query(`DROP TABLE "product_categories"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c80b92276d57bd3b469eccd62e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3d396f66a33e2328f439515abd"`,
    );
    await queryRunner.query(`DROP TABLE "variant_option_values"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c351cd4db6142b522da9068838"`,
    );
    await queryRunner.query(`DROP TABLE "inventory"`);
    await queryRunner.query(`DROP TYPE "public"."inventory_status_enum"`);
    await queryRunner.query(`DROP TABLE "branches"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5a9dade7a4baafc128f8e0d804"`,
    );
    await queryRunner.query(`DROP TABLE "carts"`);
    await queryRunner.query(`DROP TYPE "public"."carts_status_enum"`);
    await queryRunner.query(`DROP TABLE "cart_items"`);
    await queryRunner.query(`DROP TABLE "price_tiers"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d40b39783ca1a0db443aa422d9"`,
    );
    await queryRunner.query(`DROP TABLE "price_list_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_464f927ae360106b783ed0b410"`,
    );
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP TYPE "public"."products_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_46f236f21640f9da218a063a86"`,
    );
    await queryRunner.query(`DROP TABLE "product_variants"`);
    await queryRunner.query(`DROP TABLE "product_options"`);
    await queryRunner.query(
      `DROP TYPE "public"."product_options_display_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "product_option_values"`);
    await queryRunner.query(`DROP TABLE "product_images"`);
    await queryRunner.query(`DROP TABLE "product_attributes"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_420d9f679d41281f282f5bc7d0"`,
    );
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b15428f362be2200922952dc26"`,
    );
    await queryRunner.query(`DROP TABLE "brands"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bc96df35477b27f8c7a9a214ee"`,
    );
    await queryRunner.query(`DROP TABLE "customers"`);
    await queryRunner.query(`DROP TYPE "public"."customers_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."customers_role_enum"`);
    await queryRunner.query(`DROP TYPE "public"."customers_type_enum"`);
    await queryRunner.query(`DROP TABLE "b2b_profiles"`);
    await queryRunner.query(`DROP TABLE "addresses"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6c3a8d384c72ec02bd6dc0ebfe"`,
    );
    await queryRunner.query(`DROP TABLE "wards"`);
    await queryRunner.query(`DROP TABLE "provinces"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3084ab1ce203cff522888bf5e7"`,
    );
    await queryRunner.query(`DROP TABLE "back_in_stock_subscriptions"`);
    await queryRunner.query(`DROP TABLE "shipments"`);
    await queryRunner.query(`DROP TYPE "public"."shipments_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e290dcae2c0ff391ceea3e8978"`,
    );
    await queryRunner.query(`DROP TABLE "shipping_methods"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b2f7b823a21562eeca20e72b00"`,
    );
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payments_method_code_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_772d0ce0473ac2ccfa26060dbe"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3e413c10c595c04c6c70e58a4d"`,
    );
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TYPE "public"."orders_payment_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."orders_fulfillment_enum"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9482e9567d8dcc2bc615981ef4"`,
    );
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`DROP TYPE "public"."reviews_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0af64d5936a69889a91978ce81"`,
    );
    await queryRunner.query(`DROP TABLE "voucher_redemptions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_efc30b2b9169e05e0e1e19d6dd"`,
    );
    await queryRunner.query(`DROP TABLE "vouchers"`);
    await queryRunner.query(`DROP TYPE "public"."vouchers_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1ecae3acee67b8f1b5ae9f5149"`,
    );
    await queryRunner.query(`DROP TABLE "wishlists"`);
    await queryRunner.query(`DROP TABLE "wishlist_items"`);
  }
}
