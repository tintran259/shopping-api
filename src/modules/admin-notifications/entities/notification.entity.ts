import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { NotificationType } from '../../../common/enums';

/** Payload điều hướng/hiển thị đính kèm (theo loại). Với ORDER: đơn + chi nhánh. */
export interface NotificationData {
  orderId?: string;
  orderCode?: string;
  branchId?: string;
  branchName?: string;
  [key: string]: unknown;
}

/**
 * Một thông báo Back Office **theo từng người nhận** (fan-out: mỗi recipient một
 * row, có trạng thái đọc riêng). `link` là đường dẫn tương đối trên BO để click
 * điều hướng (vd `/orders/<id>`).
 */
@Entity('admin_notifications')
@Index(['recipientId', 'readAt'])
@Index(['recipientId', 'createdAt'])
export class Notification extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId: string;

  @ApiProperty({ enum: NotificationType })
  @Column({ type: 'enum', enum: NotificationType, enumName: 'notification_type_enum' })
  type: NotificationType;

  @ApiProperty()
  @Column()
  title: string;

  @ApiProperty()
  @Column({ type: 'text' })
  body: string;

  @ApiProperty({ required: false, description: 'Đường dẫn BO khi click.' })
  @Column({ type: 'varchar', nullable: true })
  link?: string;

  @ApiProperty({ required: false, type: 'object', additionalProperties: true })
  @Column({ type: 'jsonb', nullable: true })
  data?: NotificationData;

  @ApiProperty({ required: false, description: 'Null = chưa đọc.' })
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date | null;
}
