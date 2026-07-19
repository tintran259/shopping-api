import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Thêm giá trị `review` vào enum `notification_type_enum` để thông báo BO khi có
 * đánh giá sản phẩm điểm thấp (≤2★). Postgres cho phép ADD VALUE trong migration
 * miễn là không dùng giá trị mới ngay trong cùng transaction (ở đây chỉ thêm).
 */
export class NotificationTypeReview1785000000000 implements MigrationInterface {
  name = 'NotificationTypeReview1785000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'review'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres không hỗ trợ bỏ 1 giá trị enum — no-op (giữ giá trị 'review').
  }
}
