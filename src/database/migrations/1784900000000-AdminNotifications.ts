import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BO Notification Center: `admin_notifications` (mỗi người nhận một row, có
 * trạng thái đọc riêng) + `notification_settings` (bật/tắt từng loại cho mỗi
 * tài khoản; vắng row = mặc định BẬT). Enum `notification_type_enum` dùng chung.
 */
export class AdminNotifications1784900000000 implements MigrationInterface {
  name = 'AdminNotifications1784900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `DO $$ BEGIN
        CREATE TYPE "notification_type_enum" AS ENUM (
          'order','complaint','refund','inventory','promotion','customer','product','system'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );

    await q.query(`
      CREATE TABLE IF NOT EXISTS "admin_notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "recipient_id" uuid NOT NULL,
        "type" "notification_type_enum" NOT NULL,
        "title" character varying NOT NULL,
        "body" text NOT NULL,
        "link" character varying,
        "data" jsonb,
        "read_at" timestamptz,
        CONSTRAINT "PK_admin_notifications" PRIMARY KEY ("id")
      )
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_notifications_recipient_read"
       ON "admin_notifications" ("recipient_id", "read_at")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_notifications_recipient_created"
       ON "admin_notifications" ("recipient_id", "created_at")`,
    );

    await q.query(`
      CREATE TABLE IF NOT EXISTS "notification_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "customer_id" uuid NOT NULL,
        "type" "notification_type_enum" NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_notification_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_settings_customer_type" UNIQUE ("customer_id", "type")
      )
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notification_settings_customer"
       ON "notification_settings" ("customer_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "notification_settings"`);
    await q.query(`DROP TABLE IF EXISTS "admin_notifications"`);
    await q.query(`DROP TYPE IF EXISTS "notification_type_enum"`);
  }
}
