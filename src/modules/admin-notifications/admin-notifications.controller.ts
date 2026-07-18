import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { AdminNotificationsService } from './admin-notifications.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { UpdateNotificationSettingsDto } from './dto/update-settings.dto';

/**
 * Notification Center — **cá nhân** cho mỗi user BO. Không gắn `@RequirePermission`:
 * bất kỳ tài khoản đăng nhập nào cũng xem thông báo của CHÍNH mình; mọi truy vấn
 * đều lọc theo `recipientId = current user` nên không lộ chéo.
 */
@ApiTags('admin-notifications')
@ApiBearerAuth()
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly service: AdminNotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách thông báo của tôi (phân trang)' })
  list(@CurrentUser() user: AuthUser, @Query() query: NotificationQueryDto) {
    return this.service.list(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Số thông báo chưa đọc' })
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.service.unreadCount(user.id);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Cài đặt bật/tắt từng loại thông báo' })
  getSettings(@CurrentUser() user: AuthUser) {
    return this.service.getSettings(user.id);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Cập nhật cài đặt thông báo' })
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.service.updateSettings(user.id, dto.settings);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu 1 thông báo đã đọc' })
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.markRead(user.id, id);
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đánh dấu tất cả đã đọc' })
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.service.markAllRead(user.id);
  }
}
