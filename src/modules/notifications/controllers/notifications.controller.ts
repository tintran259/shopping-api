import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { SubscribeBackInStockDto } from '../dto/subscribe.dto';
import { NotificationsService } from '../services/notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Public()
  @Post('back-in-stock')
  @ApiOperation({ summary: 'Notify me when a variant is back in stock' })
  subscribe(@Body() dto: SubscribeBackInStockDto) {
    return this.notifications.subscribeBackInStock(dto);
  }
}
