import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './controllers/notifications.controller';
import { BackInStockSubscription } from './entities/back-in-stock-subscription.entity';
import { NotificationsRepository } from './repositories/notifications.repository';
import { MailService } from './services/mail.service';
import { NotificationsService } from './services/notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([BackInStockSubscription])],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRepository, MailService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
