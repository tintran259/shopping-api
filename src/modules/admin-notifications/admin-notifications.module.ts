import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AdminNotificationsService } from './admin-notifications.service';
import { NotificationSetting } from './entities/notification-setting.entity';
import { Notification } from './entities/notification.entity';
import { NotificationsGateway } from './notifications.gateway';

/**
 * Notification Center của Back Office (in-app + realtime qua WebSocket). Tách
 * biệt hoàn toàn với `NotificationsModule` (back-in-stock của storefront).
 * Export service để `OrdersModule` gọi khi có đơn storefront mới.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationSetting, Customer]),
    // Gateway xác thực JWT của socket bằng cùng secret với REST.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.expiresIn') },
      }),
    }),
  ],
  controllers: [AdminNotificationsController],
  providers: [AdminNotificationsService, NotificationsGateway],
  exports: [AdminNotificationsService],
})
export class AdminNotificationsModule {}
