import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { NotificationType } from '../../../common/enums';

/**
 * Bật/tắt một loại thông báo cho một tài khoản.
 *
 * **Vắng row = mặc định BẬT** — nên không cần seed cho user mới. Chỉ khi người
 * dùng tắt một loại mới lưu row `enabled=false`. `getSettings` sẽ merge với mặc
 * định BẬT cho mọi `NotificationType`.
 */
@Entity('notification_settings')
@Unique(['customerId', 'type'])
export class NotificationSetting extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Index()
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @ApiProperty({ enum: NotificationType })
  @Column({ type: 'enum', enum: NotificationType, enumName: 'notification_type_enum' })
  type: NotificationType;

  @ApiProperty()
  @Column({ default: true })
  enabled: boolean;
}
